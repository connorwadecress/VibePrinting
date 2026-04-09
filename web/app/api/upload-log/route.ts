/**
 * GET /api/upload-log?brand=&limit=
 *
 * Returns the most recent upload log entries, newest first.
 * `brand` filters to a single brand id; `limit` defaults to 100,
 * capped at 1000 by the reader.
 */

import { requireAuth } from "@/lib/auth";
import { readUploadLog, listLoggedBrands } from "@/lib/upload-log-reader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const brand = url.searchParams.get("brand") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  const entries = readUploadLog({
    brand: brand || undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  return new Response(
    JSON.stringify({ entries, brands: listLoggedBrands() }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
