/**
 * GET /api/runs/[jobId]/artifact?name=<relative-path>
 *
 * Serves a file from the job's run directory with a sensible Content-Type.
 *
 * Security: `name` is resolved with path-traversal protection (the result
 * must stay inside runDir). Symlinks pointing outside are rejected by
 * resolveArtifact via path.relative.
 *
 * For mp4 we honor Range requests so the HTML5 <video> player can seek.
 * Smaller assets (json, svg, html) get a single 200 response.
 */

import fs from "node:fs";
import { requireAuth, canAccessBrand, brandForbidden } from "@/lib/auth";
import { getJob } from "@/lib/job-store";
import { resolveArtifact, mimeForArtifact } from "@/lib/run-artifacts";

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
  if (!job) return notFound("job");
  if (!canAccessBrand(job.brandId, auth)) return brandForbidden(job.brandId);
  if (!job.runDir) return notFound("runDir");

  const url = new URL(request.url);
  const name = url.searchParams.get("name");
  if (!name) {
    return new Response(JSON.stringify({ error: "name is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const filePath = resolveArtifact(job.runDir, name);
  if (!filePath) return notFound("artifact");

  const stat = fs.statSync(filePath);
  const mime = mimeForArtifact(filePath);
  const range = request.headers.get("range");

  if (range) {
    return rangeResponse(filePath, stat.size, mime, range);
  }

  // Stream small/medium files; convert Node Readable to a Web ReadableStream.
  const nodeStream = fs.createReadStream(filePath);
  const webStream = nodeReadableToWebStream(nodeStream);
  return new Response(webStream, {
    status: 200,
    headers: {
      "content-type": mime,
      "content-length": String(stat.size),
      "accept-ranges": "bytes",
      "cache-control": "no-store",
    },
  });
}

function notFound(what: string) {
  return new Response(JSON.stringify({ error: `${what} not found` }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
}

function rangeResponse(filePath: string, totalSize: number, mime: string, range: string) {
  const match = range.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) {
    return new Response(null, { status: 416, headers: { "content-range": `bytes */${totalSize}` } });
  }
  const startStr = match[1];
  const endStr = match[2];
  let start = startStr ? parseInt(startStr, 10) : 0;
  let end = endStr ? parseInt(endStr, 10) : totalSize - 1;
  if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= totalSize) {
    return new Response(null, { status: 416, headers: { "content-range": `bytes */${totalSize}` } });
  }

  const nodeStream = fs.createReadStream(filePath, { start, end });
  const webStream = nodeReadableToWebStream(nodeStream);
  return new Response(webStream, {
    status: 206,
    headers: {
      "content-type": mime,
      "content-length": String(end - start + 1),
      "content-range": `bytes ${start}-${end}/${totalSize}`,
      "accept-ranges": "bytes",
      "cache-control": "no-store",
    },
  });
}

function nodeReadableToWebStream(node: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      node.on("data", (chunk: Buffer | string) => {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        controller.enqueue(new Uint8Array(buf));
      });
      node.on("end", () => controller.close());
      node.on("error", (err) => controller.error(err));
    },
    cancel() {
      (node as fs.ReadStream).destroy();
    },
  });
}
