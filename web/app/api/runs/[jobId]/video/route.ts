/**
 * GET /api/runs/[jobId]/video
 *
 * Streams the final.mp4 from a job's run directory with HTTP Range
 * support so the browser <video> element can scrub. Refuses any
 * path outside OUTPUT_DIR (defense in depth — runDir is set by the
 * pipeline log parser, but operators can edit jobs.json directly).
 */

import fs from "node:fs";
import path from "node:path";
import { requireAuth } from "@/lib/auth";
import { getJob } from "@/lib/job-store";
import { inspectRun, isInsideOutputDir } from "@/lib/run-files";

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
  if (!job) return jsonError("not_found", 404);

  const status = inspectRun(job);
  if (!status.runDir || !status.exists || !status.hasFinalMp4) {
    return jsonError("expired", 410);
  }

  const filePath = path.join(status.runDir, "final.mp4");
  if (!isInsideOutputDir(filePath)) {
    return jsonError("forbidden", 403);
  }

  const total = status.finalMp4Size;
  const range = request.headers.get("range");

  if (range) {
    // "bytes=START-END" — END optional.
    const match = /^bytes=(\d+)-(\d*)$/.exec(range.trim());
    if (!match) {
      return new Response(null, {
        status: 416,
        headers: { "content-range": `bytes */${total}` },
      });
    }
    const start = parseInt(match[1], 10);
    const end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
    if (start > end || start >= total) {
      return new Response(null, {
        status: 416,
        headers: { "content-range": `bytes */${total}` },
      });
    }

    const nodeStream = fs.createReadStream(filePath, { start, end });
    return new Response(nodeStream as unknown as ReadableStream, {
      status: 206,
      headers: {
        "content-type": "video/mp4",
        "content-length": String(end - start + 1),
        "content-range": `bytes ${start}-${end}/${total}`,
        "accept-ranges": "bytes",
        "cache-control": "no-store",
      },
    });
  }

  const nodeStream = fs.createReadStream(filePath);
  return new Response(nodeStream as unknown as ReadableStream, {
    status: 200,
    headers: {
      "content-type": "video/mp4",
      "content-length": String(total),
      "accept-ranges": "bytes",
      "cache-control": "no-store",
    },
  });
}

function jsonError(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
