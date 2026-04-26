/**
 * GET /api/runs/[jobId]/gates
 *
 * Returns the canonical pipeline stage list with derived per-stage status
 * for the given job. The job's runDir is read from the job record (set by
 * the job-manager when it parses the "[pipeline] Run: ..." log line).
 *
 * Shape:
 *   {
 *     runDir: string | null,
 *     stages: PipelineStageStatus[],
 *     gates: ApprovalGateRecord[],
 *   }
 */

import { requireAuth, canAccessBrand, brandForbidden } from "@/lib/auth";
import { getJob } from "@/lib/job-store";
import { deriveStages, listGates } from "@/lib/run-artifacts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Params {
  params: Promise<{ jobId: string }>;
}

export async function GET(request: Request, { params }: Params) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) {
    return new Response(JSON.stringify({ error: "job not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }
  if (!canAccessBrand(job.brandId, auth)) return brandForbidden(job.brandId);

  if (!job.runDir) {
    return new Response(
      JSON.stringify({ runDir: null, stages: [], gates: [] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }

  const stages = deriveStages(job.runDir, job.logTail);
  const gates = listGates(job.runDir);

  return new Response(
    JSON.stringify({ runDir: job.runDir, stages, gates }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
