/**
 * Single-operator authentication for the admin UI.
 *
 * Model: one shared `ADMIN_TOKEN` env var. Operators POST the raw
 * token to /api/login; we verify via a timing-safe compare, mint a
 * random session id, and set it as an HttpOnly cookie. Sessions
 * live in memory — restart = re-login. No database.
 *
 * This file is server-only. Do not import from client components.
 */

import crypto from "node:crypto";

export const SESSION_COOKIE_NAME = "vp_admin";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface Session {
  id: string;
  issuedAt: number;
  expiresAt: number;
}

// Middleware and route handlers are compiled as separate webpack bundles,
// so module-level state is not shared between them. Hang the session map
// off globalThis so both bundles read/write the same instance.
const g = globalThis as typeof globalThis & { __vpSessions?: Map<string, Session> };
if (!g.__vpSessions) g.__vpSessions = new Map();
const sessions = g.__vpSessions;

/**
 * Read the admin token from the environment. Returns null if unset
 * so callers can surface a clear "token not configured" message
 * rather than accidentally auto-authenticating.
 */
export function getAdminToken(): string | null {
  const raw = process.env.ADMIN_TOKEN;
  if (!raw || raw.length === 0) return null;
  return raw;
}

/**
 * Verify an operator-supplied token against ADMIN_TOKEN using a
 * constant-time compare. Returns true only when both sides have the
 * same byte length (Buffer.compare would throw otherwise) and match.
 */
export function verifyToken(candidate: string): boolean {
  const expected = getAdminToken();
  if (!expected) return false;
  const a = Buffer.from(candidate, "utf-8");
  const b = Buffer.from(expected, "utf-8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Mint a new session id and store it in the in-memory session map.
 * Callers should serialize the returned id into a Set-Cookie header.
 */
export function createSession(): Session {
  const id = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  const session: Session = { id, issuedAt: now, expiresAt: now + SESSION_TTL_MS };
  sessions.set(id, session);
  return session;
}

/**
 * Look up a session by id. Returns null if unknown or expired.
 * Expired sessions are proactively removed so the map does not
 * grow forever.
 */
export function getSession(id: string | undefined | null): Session | null {
  if (!id) return null;
  const session = sessions.get(id);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(id);
    return null;
  }
  return session;
}

/**
 * Revoke a session (used by the eventual logout endpoint).
 */
export function destroySession(id: string): void {
  sessions.delete(id);
}

/**
 * Parse a session id from a cookie header string.
 */
export function readSessionIdFromCookieHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name === SESSION_COOKIE_NAME) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

/**
 * Build a Set-Cookie header value for a freshly-issued session.
 * HttpOnly + SameSite=Lax + Secure in production.
 */
export function buildSessionCookie(session: Session): string {
  const maxAgeSec = Math.floor((session.expiresAt - Date.now()) / 1000);
  const pieces = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(session.id)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];
  if (process.env.NODE_ENV === "production") pieces.push("Secure");
  return pieces.join("; ");
}

/**
 * Build a Set-Cookie header value that clears the session cookie.
 */
export function buildClearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/**
 * Helper for API route handlers. Reads the cookie header off the
 * Request, validates the session, and returns either the session or
 * a 401 Response. Usage:
 *
 *   const auth = requireAuth(request);
 *   if (auth instanceof Response) return auth;
 */
export function requireAuth(request: Request): Session | Response {
  const cookie = request.headers.get("cookie");
  const sessionId = readSessionIdFromCookieHeader(cookie);
  const session = getSession(sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return session;
}
