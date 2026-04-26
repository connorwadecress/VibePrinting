/**
 * POST /api/runs/[jobId]/resume
 *
 * Spawn a new pipeline child that resumes the same run directory. The job
 * keeps its lane / dry-run / upload settings derived from the original job's
 * args so the operator doesn't have to re-pick anything.
 *
 * Returns the NEW jobId — callers should redirect to /runs/<newJobId>.
 *
 * The original job's runDir must already be populated. Pre-flight check:
 * at least one gate must currently be `approved` (otherwise the pipeline
 * will just halt again at the same gate, which is wasteful).
 */

import { requireAuth, canAccessBrand, brandForbidden } from "@/lib/auth";
import { getJob } from "@/lib/job-store";
import { startRun } from "@/lib/job-manager";
import { listGates } from "@/lib/run-artifacts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Params {
  params: Promise<{ jobId: string }>;
}

export async function POST(request: Request, { params }: Params) {
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
    return new Response(JSON.stringify({ error: "job has no runDir to resume" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    });
  }

  const gates = listGates(job.runDir);
  if (gates.length === 0) {
    return new Response(JSON.stringify({ error: "no approval gates found in this run" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    });
  }
  if (!gates.some((g) => g.status === "approved")) {
    return new Response(
      JSON.stringify({
        error:
          "no gate has been approved — the pipeline would halt at the same place. Approve a gate first.",
      }),
      { status: 409, headers: { "content-type": "application/json" } },
    );
  }

  // Inherit upload intent from the original job so resumed runs publish if
  // the original was --upload. We don't currently persist platforms on the
  // job record, so fall back to the default set when the original job had
  // an upload step.
  const wasUpload = job.args.includes("--upload");
  const dryRun = job.args.includes("--dry-run");

  try {
    const result = startRun({
      brandId: job.brandId,
      resume: job.runDir,
      dryRun,
      upload: wasUpload,
      platforms: wasUpload ? ["youtube", "tiktok"] : [],
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
