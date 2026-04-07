/**
 * POST /api/login
 *
 * Body: { token: string }
 *
 * Verifies the operator-supplied token against ADMIN_TOKEN via a
 * timing-safe compare. On success, mints a session and sets the
 * vp_admin HttpOnly cookie. On failure, returns 401.
 */

import { buildSessionCookie, createSession, getAdminToken, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  // If the operator hasn't configured ADMIN_TOKEN at all, surface a
  // distinct 503 so they don't waste time guessing tokens against an
  // unconfigured server.
  if (!getAdminToken()) {
    return new Response(
      JSON.stringify({ error: "ADMIN_TOKEN env var is not set on the server" }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  let body: { token?: unknown };
  try {
    body = (await request.json()) as { token?: unknown };
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const token = typeof body.token === "string" ? body.token : "";
  if (!token || !verifyToken(token)) {
    return new Response(JSON.stringify({ error: "invalid token" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const session = createSession();
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": buildSessionCookie(session),
    },
  });
}
