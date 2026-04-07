/**
 * GET  /api/brands/[id]   — full ChannelProfile JSON
 * PUT  /api/brands/[id]   — replace ChannelProfile (zod-validated, atomic write)
 *
 * In Phase 3 only GET is wired up. PUT lands in Phase 4 (brand editor)
 * but the handler is already here so the route is complete.
 */

import { requireAuth } from "@/lib/auth";
import { readBrandProfile, writeBrandProfile } from "@/lib/brand-io";
import { ZodError } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  // Next 15 returns params as a Promise that must be awaited.
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;
  try {
    const profile = readBrandProfile(id);
    return new Response(JSON.stringify({ profile }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? String(err) }),
      { status: 404, headers: { "content-type": "application/json" } },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const saved = writeBrandProfile(id, payload);
    return new Response(JSON.stringify({ profile: saved }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return new Response(
        JSON.stringify({ error: "validation_failed", issues: err.issues }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? String(err) }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
