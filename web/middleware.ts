/**
 * Route gating for the admin UI.
 *
 * Every route is protected except:
 *   - /login             (token entry form)
 *   - /api/login         (POST token)
 *   - /api/health        (liveness probe for docker-compose)
 *   - Next internals (/_next/*)
 *   - static assets     (favicon, etc.)
 *
 * For browser requests we redirect to /login?redirect=<original>.
 * For /api/* we return 401 JSON so fetch() callers can handle it.
 *
 * This middleware runs on the Node runtime so it can read from the
 * session store in web/lib/auth.ts (edge runtime has no module-level
 * shared memory between requests).
 */

import { NextResponse, type NextRequest } from "next/server";
import { getSession, readSessionIdFromCookieHeader } from "@/lib/auth";

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     *  - _next/static, _next/image (Next internals)
     *  - favicon.ico
     *  - files with an extension (bundled assets)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
  // Force Node runtime so we can share the in-memory session map
  // with route handlers.
  runtime: "nodejs",
};

const PUBLIC_PATHS = new Set<string>(["/login", "/api/login", "/api/health"]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const sessionId = readSessionIdFromCookieHeader(request.headers.get("cookie"));
  const session = getSession(sessionId);
  if (session) return NextResponse.next();

  // API requests: 401 JSON.
  if (pathname.startsWith("/api/")) {
    return new NextResponse(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  // Browser request: redirect to /login with the original URL.
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("redirect", pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}
