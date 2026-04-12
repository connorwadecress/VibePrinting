/**
 * GET  /api/runs   — list jobs visible to the current session
 * POST /api/runs   — start a new pipeline run via job-manager
 *
 * GET filters to brands owned by the session.
 * POST enforces brand ownership before spawning.
 *
 * Body for POST:
 *   {
 *     brandId: string,
 *     lane?: string | null,
 *     dryRun?: boolean,
 *     platforms?: ("youtube"|"tiktok")[]   // omit/empty = no upload
 *   }
 */

import { requireAuth, canAccessBrand, brandForbidden, filterBrands } from "@/lib/auth";
import { listJobs } from "@/lib/job-store";
import { startRun } from "@/lib/job-manager";
import { listBrandIds } from "@/lib/brand-io";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const allJobs = listJobs();
  const visibleBrands = new Set(filterBrands(listBrandIds(), auth));
  const jobs = allJobs.filter((j) => visibleBrands.has(j.brandId));
  return new Response(JSON.stringify({ jobs }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(request: Request) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  let body: {
    brandId?: string;
    lane?: string | null;
    dryRun?: boolean;
    platforms?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!body.brandId || typeof body.brandId !== "string") {
    return new Response(JSON.stringify({ error: "brandId is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!canAccessBrand(body.brandId, auth)) return brandForbidden(body.brandId);

  // Whitelist platforms so callers can't smuggle arbitrary strings
  // into VP_PLATFORMS.
  const allowedPlatforms = new Set(["youtube", "tiktok"]);
  const platforms = (body.platforms ?? []).filter((p) => allowedPlatforms.has(p));

  try {
    const result = startRun({
      brandId: body.brandId,
      lane: body.lane ?? null,
      dryRun: !!body.dryRun,
      upload: platforms.length > 0,
      platforms,
      trigger: "manual",
    });
    return new Response(JSON.stringify({ jobId: result.jobId, job: result.job }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? String(err) }),
      { status: 409, headers: { "content-type": "application/json" } },
    );
  }
}
