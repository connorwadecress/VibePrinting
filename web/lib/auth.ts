/**
 * Per-user authentication for the admin UI.
 *
 * Users are defined entirely via environment variables — no database,
 * no self-registration:
 *
 *   VP_USER_1_ID=alice
 *   VP_USER_1_TOKEN=some-secret
 *   VP_USER_1_BRANDS=brand-a,brand-b
 *
 *   VP_USER_2_ID=bob
 *   VP_USER_2_TOKEN=another-secret
 *   VP_USER_2_BRANDS=brand-c
 *
 * Up to VP_USER_20_* supported. Each user can only see and manage
 * their own brands. There is no superuser / admin backdoor.
 *
 * Login: POST /api/login with { username, token }.
 * Sessions live in memory — restart = re-login. No database.
 * This file is server-only. Do not import from client components.
 */

import crypto from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "vp_admin";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface Session {
  id: string;
  userId: string;
  /** Brand ids this user is allowed to access. */
  ownedBrands: string[];
  issuedAt: number;
  expiresAt: number;
}

interface UserEntry {
  token: string;
  ownedBrands: string[];
}

// ---------------------------------------------------------------------------
// Sessions — anchored on globalThis so all webpack chunks share one map.
// ---------------------------------------------------------------------------
type AuthGlobal = {
  __vpSessions?: Map<string, Session>;
};
const g = globalThis as typeof globalThis & AuthGlobal;
if (!g.__vpSessions) g.__vpSessions = new Map();

const sessions: Map<string, Session> = g.__vpSessions;

// ---------------------------------------------------------------------------
// User registry — rebuilt fresh on every call so HMR / late .env loads
// never cause a stale empty registry.  Env vars are static at runtime so
// rebuilding is cheap.
// ---------------------------------------------------------------------------
function buildUserRegistry(): Map<string, UserEntry> {
  const registry = new Map<string, UserEntry>();
  for (let i = 1; i <= 20; i++) {
    const id = process.env[`VP_USER_${i}_ID`];
    const token = process.env[`VP_USER_${i}_TOKEN`];
    const brandsRaw = process.env[`VP_USER_${i}_BRANDS`];
    if (!id || !token) continue;
    const ownedBrands = brandsRaw
      ? brandsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    registry.set(id, { token, ownedBrands });
  }
  console.log("[auth] user registry:", Array.from(registry.keys()));
  return registry;
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify username + token. Returns a resolved identity on success, null on failure.
 *
 * Logic:
 * 1. If username matches a VP_USER_*_ID entry, verify token against that user.
 * 2. Otherwise fall back to ADMIN_TOKEN (username ignored for backward compat).
 */
export function verifyCredentials(
  username: string,
  token: string,
): { userId: string; ownedBrands: string[] } | null {
  if (!token || !username) return null;

  // Rebuild the registry fresh each call so HMR never serves stale data.
  const userRegistry = buildUserRegistry();

  const user = userRegistry.get(username);
  if (!user) return null;
  if (!timingSafeEqual(token, user.token)) return null;
  return { userId: username, ownedBrands: user.ownedBrands };
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

export function createSession(userId: string, ownedBrands: string[]): Session {
  const id = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  const session: Session = { id, userId, ownedBrands, issuedAt: now, expiresAt: now + SESSION_TTL_MS };
  sessions.set(id, session);
  return session;
}

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

export function destroySession(id: string): void {
  sessions.delete(id);
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

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

export function buildSessionCookie(session: Session): string {
  const maxAgeSec = Math.floor((session.expiresAt - Date.now()) / 1000);
  const pieces = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(session.id)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`,
  ];
  if (process.env.NODE_ENV === "production" && process.env.SECURE_COOKIE !== "false") pieces.push("Secure");
  return pieces.join("; ");
}

export function buildClearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// ---------------------------------------------------------------------------
// Auth helpers for route handlers and server components
// ---------------------------------------------------------------------------

/**
 * For API route handlers. Reads the session from the request cookie header.
 * Returns the Session or a 401 Response.
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

/**
 * For server components (uses next/headers). Returns null if unauthenticated.
 */
export async function getServerSession(): Promise<Session | null> {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE_NAME)?.value;
  return getSession(sessionId);
}

/**
 * Check if a session can access a specific brand.
 */
export function canAccessBrand(brandId: string, session: Session): boolean {
  return session.ownedBrands.includes(brandId);
}

/**
 * Filter a list of brand ids to those accessible by the session.
 */
export function filterBrands(brandIds: string[], session: Session): string[] {
  return brandIds.filter((id) => session.ownedBrands.includes(id));
}

/**
 * Return a 403 Response for brand access denial.
 */
export function brandForbidden(brandId: string): Response {
  return new Response(
    JSON.stringify({ error: `Access denied to brand "${brandId}"` }),
    { status: 403, headers: { "content-type": "application/json" } },
  );
}
