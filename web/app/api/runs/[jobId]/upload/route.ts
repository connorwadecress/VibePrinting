/**
 * POST /api/runs/[jobId]/upload
 *
 * Body: { platform: "youtube" | "tiktok" }
 *
 * Spawns the retry-upload script for an already-completed run. The
 * child's stdout/stderr is piped into the original job's logTail and
 * SSE bus, so the Run page log viewer shows progress inline.
 *
 * Returns immediately after spawn — the UI repolls /files to detect
 * completion and the new uploadedPlatforms list.
 */

import { requireAuth } from "@/lib/auth";
import { startManualUpload } from "@/lib/job-manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

const ALLOWED = new Set(["youtube", "tiktok"]);

export async function POST(request: Request, context: RouteContext) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { jobId } = await context.params;
  let body: { platform?: string };
  try {
    body = (await request.json()) as { platform?: string };
  } catch {
    return jsonError("invalid_json", 400);
  }
  const platform = (body.platform ?? "").toLowerCase();
  if (!ALLOWED.has(platform)) {
    return jsonError(`unsupported_platform: ${platform}`, 400);
  }

  try {
    const result = startManualUpload({
      jobId,
      platform: platform as "youtube" | "tiktok",
    });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return jsonError((err as Error).message ?? "spawn_failed", 409);
  }
}

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
