/**
 * Liveness probe for docker-compose. No auth, no I/O — just confirms
 * the Node process is up and the route handler is reachable.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return new Response(
    JSON.stringify({ status: "ok", ts: new Date().toISOString() }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
