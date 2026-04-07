/**
 * POST /api/runs/[jobId]/cancel — SIGTERM the job's child process.
 */

import { requireAuth } from "@/lib/auth";
import { cancelJob } from "@/lib/job-manager";
import { getJob } from "@/lib/job-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
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
  const sent = cancelJob(jobId);
  return new Response(JSON.stringify({ cancelled: sent, job: getJob(jobId) }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
