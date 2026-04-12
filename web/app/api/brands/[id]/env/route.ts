/**
 * GET  /api/brands/[id]/env  — read whitelisted brand env vars
 * PUT  /api/brands/[id]/env  — write a partial patch of whitelisted keys
 *
 * Both require session ownership of the brand.
 * Only keys in BRAND_ENV_WHITELIST are readable or writable.
 */

import { requireAuth, canAccessBrand, brandForbidden } from "@/lib/auth";
import { readBrandEnv, writeBrandEnv } from "@/lib/brand-env-io";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;
  if (!canAccessBrand(id, auth)) return brandForbidden(id);

  try {
    const env = readBrandEnv(id);
    return new Response(JSON.stringify({ env }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? String(err) }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;
  if (!canAccessBrand(id, auth)) return brandForbidden(id);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!body || typeof body !== "object") {
    return new Response(JSON.stringify({ error: "body must be an object" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const env = writeBrandEnv(id, body as Record<string, string>);
    return new Response(JSON.stringify({ env }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? String(err) }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }
}
