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
import { listBrandIds, readBrandProfile } from "@/lib/brand-io";

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
    topicSeed?: string | null;
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

  // Map an optional topic seed to the env var the relevant pipeline
  // stage knows how to read. Reddit-story uses VP_REDDIT_POST_URL;
  // everything else uses VP_TOPIC_SEED. We need a specific lane to
  // know which variant to set — refuse seed without lane.
  const envOverrides: Record<string, string> = {};
  const seed = typeof body.topicSeed === "string" ? body.topicSeed.trim() : "";
  if (seed) {
    if (!body.lane) {
      return new Response(
        JSON.stringify({ error: "topicSeed requires a specific lane (not 'any')" }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    try {
      const profile = readBrandProfile(body.brandId);
      const lane = profile.contentLanes.find((l) => l.id === body.lane);
      if (!lane) {
        return new Response(
          JSON.stringify({ error: `lane "${body.lane}" not found on brand` }),
          { status: 400, headers: { "content-type": "application/json" } },
        );
      }
      const laneType = lane.type ?? "pexels-api";
      if (laneType === "reddit-story") envOverrides.VP_REDDIT_POST_URL = seed;
      else envOverrides.VP_TOPIC_SEED = seed;
    } catch (err) {
      return new Response(
        JSON.stringify({ error: `failed to read brand profile: ${(err as Error).message}` }),
        { status: 500, headers: { "content-type": "application/json" } },
      );
    }
  }

  try {
    const result = startRun({
      brandId: body.brandId,
      lane: body.lane ?? null,
      dryRun: !!body.dryRun,
      upload: platforms.length > 0,
      platforms,
      trigger: "manual",
      envOverrides: Object.keys(envOverrides).length > 0 ? envOverrides : undefined,
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
