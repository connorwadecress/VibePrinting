/**
 * GET /api/schedule — schedules.json filtered to the session's owned brands.
 *
 * The UI uses the brand list to render rows for brands that have no
 * entry yet, so the operator can enable scheduling without hand-editing JSON.
 */

import { requireAuth, filterBrands } from "@/lib/auth";
import { readSchedules } from "@/lib/schedule-fs";
import { listBrandIds } from "@/lib/brand-io";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const data = readSchedules();
  const allIds = listBrandIds();
  const brandIds = filterBrands(allIds, auth);

  // Also filter the schedules map to only owned brands.
  const schedules = Object.fromEntries(
    Object.entries(data.schedules).filter(([id]) => brandIds.includes(id)),
  );

  return new Response(JSON.stringify({ ...data, schedules, brandIds }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
