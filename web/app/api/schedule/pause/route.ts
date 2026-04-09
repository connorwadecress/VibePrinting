/**
 * POST /api/schedule/pause — flip the global pause flag.
 *
 * Body: { globalPaused: boolean }
 *
 * The scheduler picks the change up via fs.watch and tears down all
 * armed tasks. Manual triggers via /api/runs are NOT affected.
 */

import { requireAuth } from "@/lib/auth";
import { setGlobalPause } from "@/lib/schedule-fs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  let body: { globalPaused?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (typeof body.globalPaused !== "boolean") {
    return new Response(JSON.stringify({ error: "globalPaused (boolean) required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const updated = setGlobalPause(body.globalPaused);
  return new Response(JSON.stringify({ globalPaused: updated.globalPaused }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
