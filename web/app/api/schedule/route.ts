/**
 * GET /api/schedule — schedules visible to the session, with the brand
 * lane catalog bundled in so the editor can populate type/lane dropdowns.
 *
 * Returns:
 *   {
 *     version: 2,
 *     globalPaused: boolean,
 *     schedules: ScheduleEntry[],
 *     brands: Array<{ id, displayName, lanes: { id, type }[] }>
 *   }
 */

import { requireAuth, filterBrands } from "@/lib/auth";
import { readSchedules } from "@/lib/schedule-fs";
import { listBrandIds, readBrandProfile } from "@/lib/brand-io";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const data = readSchedules();
  const allIds = listBrandIds();
  const brandIds = filterBrands(allIds, auth);
  const owned = new Set(brandIds);

  const schedules = data.schedules.filter((s) => owned.has(s.brandId));

  const brands = brandIds.map((id) => {
    try {
      const profile = readBrandProfile(id);
      return {
        id: profile.id,
        displayName: profile.displayName,
        lanes: profile.contentLanes.map((l) => ({
          id: l.id,
          type: (l.type ?? "pexels-api") as "pexels-api" | "reddit-story",
        })),
      };
    } catch {
      return { id, displayName: id, lanes: [] as { id: string; type: "pexels-api" | "reddit-story" }[] };
    }
  });

  return new Response(
    JSON.stringify({
      version: 2,
      globalPaused: data.globalPaused,
      schedules,
      brands,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
