/**
 * POST /api/login
 *
 * Body: { username: string, token: string }
 *
 * Verifies credentials against the VP_USER_*_ID / VP_USER_*_TOKEN
 * registry. On success, mints a session and sets the vp_admin
 * HttpOnly cookie. On failure, returns 401.
 */

import { buildSessionCookie, createSession, verifyCredentials } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { username?: unknown; token?: unknown };
  try {
    body = (await request.json()) as { username?: unknown; token?: unknown };
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const token = typeof body.token === "string" ? body.token : "";

  const identity = verifyCredentials(username, token);
  if (!identity) {
    return new Response(JSON.stringify({ error: "invalid credentials" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const session = createSession(identity.userId, identity.ownedBrands);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": buildSessionCookie(session),
    },
  });
}
