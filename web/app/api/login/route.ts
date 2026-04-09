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
  const adminToken = getAdminToken();
  console.log("[login] POST /api/login called");
  console.log("[login] ADMIN_TOKEN set:", adminToken !== null, "| length:", adminToken?.length ?? 0);
  console.log("[login] NODE_ENV:", process.env.NODE_ENV);

  if (!adminToken) {
    console.error("[login] ADMIN_TOKEN env var is not set — returning 503");
    return new Response(
      JSON.stringify({ error: "ADMIN_TOKEN env var is not set on the server" }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  let body: { token?: unknown };
  try {
    body = (await request.json()) as { token?: unknown };
  } catch (err) {
    console.error("[login] Failed to parse request body:", err);
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const token = typeof body.token === "string" ? body.token : "";
  console.log("[login] Received token length:", token.length);
  console.log("[login] Expected token length:", adminToken.length);
  console.log("[login] Lengths match:", token.length === adminToken.length);

  const valid = verifyToken(token);
  console.log("[login] Token valid:", valid);

  if (!token || !valid) {
    console.warn("[login] Token verification failed — returning 401");
    return new Response(JSON.stringify({ error: "invalid token" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const session = createSession();
  console.log("[login] Session created:", session.id.slice(0, 8) + "...");
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": buildSessionCookie(session),
    },
  });
}
