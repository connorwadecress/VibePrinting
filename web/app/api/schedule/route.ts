/**
 * GET /api/schedule — full schedules.json plus discovered brand list.
 *
 * The UI uses the brand list to render rows for brands that have no
 * entry yet, so the operator can enable scheduling without having to
 * hand-edit JSON first.
 */

import { requireAuth } from "@/lib/auth";
import { readSchedules } from "@/lib/schedule-fs";
import { listBrandIds } from "@/lib/brand-io";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const data = readSchedules();
  const brandIds = listBrandIds();
  return new Response(JSON.stringify({ ...data, brandIds }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
