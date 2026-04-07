/**
 * Run-files inspector — derives the disk-state of a job's run directory.
 *
 * After a pipeline run completes (with or without uploads), the run dir
 * sits in `output/run-YYYYMMDD-HHmmss/` until the deletion worker sweeps
 * it 30 minutes after the first successful upload — or, if nothing was
 * uploaded, until the operator manually disposes of it.
 *
 * The admin UI wants to know:
 *   - Is the run dir still on disk?
 *   - Where is final.mp4 (and how big)?
 *   - When (if ever) is the deletion worker going to remove it?
 *   - Which platforms has this run already been uploaded to?
 *
 * This module is the single source of truth for those questions. It
 * touches the filesystem, the deletion queue, and the upload log; it
 * never mutates anything.
 */

import fs from "node:fs";
import path from "node:path";
import { OUTPUT_DIR, DELETION_QUEUE_PATH } from "@/lib/paths";
import type { JobRecord } from "@/lib/job-store";
import { readUploadLog } from "@/lib/upload-log-reader";
import type { UploadLogEntry } from "@pipeline/domain/upload-log";
import type { RunFilesStatus } from "@/lib/run-files-types";

export type { RunFilesStatus, RunFilesPayload } from "@/lib/run-files-types";

/**
 * Resolve the run directory for a job. Prefers the explicit `runDir`
 * stored on the JobRecord (set by the pipeline log parser); falls
 * back to deriving it from the job's startedAt timestamp + brand
 * convention only if no explicit value exists.
 */
export function resolveRunDir(job: JobRecord): string | null {
  if (job.runDir) return path.resolve(job.runDir);
  return null;
}

function readDeletionEntryFor(runDir: string): { deleteAfter: string } | null {
  if (!fs.existsSync(DELETION_QUEUE_PATH)) return null;
  try {
    const raw = fs.readFileSync(DELETION_QUEUE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as {
      entries?: Array<{
        runDir: string;
        deleteAfter: string;
        status: "pending" | "completed" | "failed";
      }>;
    };
    if (!Array.isArray(parsed?.entries)) return null;
    const target = path.resolve(runDir);
    for (const entry of parsed.entries) {
      if (entry.status !== "pending") continue;
      if (path.resolve(entry.runDir) === target) {
        return { deleteAfter: entry.deleteAfter };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Inspect a job's on-disk artifacts. Pure read; cheap enough to call
 * on every render of the run detail page.
 */
export function inspectRun(job: JobRecord): RunFilesStatus {
  const runDir = resolveRunDir(job);
  const runId = runDir ? path.basename(runDir) : null;

  let exists = false;
  let hasFinalMp4 = false;
  let finalMp4Size = 0;
  let hasScript = false;

  if (runDir) {
    try {
      const stat = fs.statSync(runDir);
      exists = stat.isDirectory();
    } catch {
      exists = false;
    }
    if (exists) {
      try {
        const mp4 = fs.statSync(path.join(runDir, "final.mp4"));
        hasFinalMp4 = mp4.isFile();
        finalMp4Size = mp4.size;
      } catch {}
      try {
        const script = fs.statSync(path.join(runDir, "script.json"));
        hasScript = script.isFile();
      } catch {}
    }
  }

  const deletionEntry = runDir ? readDeletionEntryFor(runDir) : null;

  // Find upload attempts for this run by scanning the tail of the
  // upload log. We pull a generous slice and filter by runId so the
  // UI sees both success and failure entries.
  let uploadedPlatforms: string[] = [];
  const lastUploads: { platform: string; entry: UploadLogEntry }[] = [];
  if (runId) {
    const logEntries = readUploadLog({ brand: job.brandId, limit: 500 });
    const matching = logEntries.filter((e) => e.runId === runId);
    // Group by platform; readUploadLog returns newest-first, so the
    // first occurrence per platform is the most recent attempt.
    const seen = new Set<string>();
    for (const e of matching) {
      if (seen.has(e.platform)) continue;
      seen.add(e.platform);
      lastUploads.push({ platform: e.platform, entry: e });
    }
    uploadedPlatforms = lastUploads
      .filter((u) => u.entry.status === "success")
      .map((u) => u.platform);
  }

  return {
    runDir,
    runId,
    exists,
    hasFinalMp4,
    finalMp4Size,
    hasScript,
    deleteAfter: deletionEntry?.deleteAfter ?? null,
    uploadedPlatforms,
    lastUploads,
  };
}

/**
 * Validate that a path lives under OUTPUT_DIR. Used by the video
 * streaming endpoint to refuse path-traversal attempts.
 */
export function isInsideOutputDir(absPath: string): boolean {
  const normalized = path.resolve(absPath);
  const root = path.resolve(OUTPUT_DIR);
  const rel = path.relative(root, normalized);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}
