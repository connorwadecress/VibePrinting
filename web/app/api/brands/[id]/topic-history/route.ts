/**
 * GET /api/brands/[id]/topic-history
 *
 * Returns the brand's topic history as a JSON array. Used by the
 * read-only history view (the page reads server-side, but the API
 * exists for future async refresh).
 */

import { requireAuth } from "@/lib/auth";
import { readBrandTopicHistory } from "@/lib/brand-io";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;
  try {
    const entries = readBrandTopicHistory(id);
    return new Response(JSON.stringify({ entries }), {
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
