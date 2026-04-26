/**
 * POST /api/runs/[jobId]/gates/[gateId]
 *
 * Update an approval gate file. Body:
 *   {
 *     action: "approve" | "request_revisions" | "reject",
 *     notes?: string,
 *   }
 *
 * The reviewer is derived from the authenticated session (auth.userId) — we
 * do not trust a client-supplied reviewer name.
 *
 * Returns the updated ApprovalGateRecord. The pipeline does NOT auto-resume;
 * call POST /api/runs/[jobId]/resume separately when ready.
 */

import { requireAuth, canAccessBrand, brandForbidden } from "@/lib/auth";
import { getJob } from "@/lib/job-store";
import { patchGate } from "@/lib/run-artifacts";
import type { ApprovalStatus } from "@pipeline/domain/models";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Params {
  params: Promise<{ jobId: string; gateId: string }>;
}

const ACTION_TO_STATUS: Record<string, ApprovalStatus> = {
  approve: "approved",
  request_revisions: "revisions_requested",
  reject: "rejected",
};

export async function POST(request: Request, { params }: Params) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { jobId, gateId } = await params;
  const job = getJob(jobId);
  if (!job) {
    return new Response(JSON.stringify({ error: "job not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }
  if (!canAccessBrand(job.brandId, auth)) return brandForbidden(job.brandId);

  if (!job.runDir) {
    return new Response(JSON.stringify({ error: "job has no runDir yet" }), {
      status: 409,
      headers: { "content-type": "application/json" },
    });
  }

  let body: { action?: string; notes?: string | null };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const status = body.action ? ACTION_TO_STATUS[body.action] : undefined;
  if (!status) {
    return new Response(
      JSON.stringify({ error: "action must be one of: approve, request_revisions, reject" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const notes =
    typeof body.notes === "string" && body.notes.trim().length > 0
      ? body.notes.trim().slice(0, 4000)
      : null;

  const updated = patchGate(job.runDir, gateId, {
    status,
    reviewer: auth.userId,
    notes,
  });
  if (!updated) {
    return new Response(JSON.stringify({ error: `gate "${gateId}" not found` }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ gate: updated }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
