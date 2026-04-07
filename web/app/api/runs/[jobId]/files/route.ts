/**
 * GET /api/runs/[jobId]/files
 *
 * Returns the on-disk state of a job's run directory: existence,
 * final.mp4 size, deletion ETA, and which platforms it has already
 * been uploaded to. Powers the preview / manual-upload UI on the
 * Run detail page.
 */

import { requireAuth } from "@/lib/auth";
import { getJob } from "@/lib/job-store";
import { inspectRun } from "@/lib/run-files";
import { isManualUploadActive } from "@/lib/job-manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { jobId } = await context.params;
  const job = getJob(jobId);
  if (!job) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const status = inspectRun(job);
  const inFlight = {
    youtube: isManualUploadActive(jobId, "youtube"),
    tiktok: isManualUploadActive(jobId, "tiktok"),
  };

  return Response.json({ status, inFlight });
}
