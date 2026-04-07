/**
 * GET /api/runs/[jobId] — return a single job record (with logTail).
 */

import { requireAuth } from "@/lib/auth";
import { getJob } from "@/lib/job-store";

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
  return new Response(JSON.stringify({ job }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
