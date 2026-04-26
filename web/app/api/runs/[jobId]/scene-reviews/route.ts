/**
 * GET  /api/runs/[jobId]/scene-reviews        — return the full reviews map
 * PUT  /api/runs/[jobId]/scene-reviews        — upsert a single scene review
 *
 * PUT body:
 *   { sceneIndex: number, status?: "approved"|"changes_requested"|"pending", notes?: string|null }
 *
 * Reviewer is taken from the authenticated session (auth.userId) so the
 * client can't spoof.
 */

import { requireAuth, canAccessBrand, brandForbidden } from "@/lib/auth";
import { getJob } from "@/lib/job-store";
import {
  readSceneReviews,
  writeSceneReview,
  type SceneReviewStatus,
} from "@/lib/scene-reviews";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Params {
  params: Promise<{ jobId: string }>;
}

const VALID_STATUSES: SceneReviewStatus[] = ["pending", "approved", "changes_requested"];

export async function GET(request: Request, { params }: Params) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) return notFound("job");
  if (!canAccessBrand(job.brandId, auth)) return brandForbidden(job.brandId);
  if (!job.runDir) {
    return new Response(JSON.stringify({ version: 1, reviews: {} }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  const file = readSceneReviews(job.runDir);
  return new Response(JSON.stringify(file), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export async function PUT(request: Request, { params }: Params) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) return notFound("job");
  if (!canAccessBrand(job.brandId, auth)) return brandForbidden(job.brandId);
  if (!job.runDir) {
    return new Response(JSON.stringify({ error: "job has no runDir yet" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    });
  }

  let body: { sceneIndex?: number; status?: string; notes?: string | null };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (typeof body.sceneIndex !== "number" || !Number.isInteger(body.sceneIndex) || body.sceneIndex < 0) {
    return new Response(JSON.stringify({ error: "sceneIndex (non-negative integer) is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const status =
    body.status && VALID_STATUSES.includes(body.status as SceneReviewStatus)
      ? (body.status as SceneReviewStatus)
      : undefined;

  const review = writeSceneReview(job.runDir, body.sceneIndex, {
    status,
    notes: body.notes === undefined ? undefined : body.notes,
    reviewer: auth.userId,
  });

  return new Response(JSON.stringify({ review }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function notFound(what: string) {
  return new Response(JSON.stringify({ error: `${what} not found` }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
}
