/**
 * Persistent JSONL upload log writer.
 *
 * Called from:
 *  - src/pipeline/stages/upload.ts  (main pipeline, per-uploader result)
 *  - src/retry-upload.ts            (manual retry CLI)
 *
 * Consumed by:
 *  - web/lib/upload-log-reader.ts   (admin UI, Phase 7)
 *
 * The log is a single append-only JSONL file at logs/upload-log.jsonl
 * (relative to process.cwd()) unless overridden via UPLOAD_LOG_PATH.
 */

import fs from "node:fs";
import path from "node:path";
import type { UploadLogEntry, UploadLogTrigger } from "../domain/upload-log.js";

function resolveLogPath(): string {
  return (
    process.env.UPLOAD_LOG_PATH ??
    path.resolve(process.cwd(), "logs", "upload-log.jsonl")
  );
}

let ensuredDir = false;
function ensureLogDir(logPath: string): void {
  if (ensuredDir) return;
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  ensuredDir = true;
}

/**
 * Append one entry to the upload log. Synchronous and atomic for the
 * small writes we produce (fs.appendFileSync uses O_APPEND on POSIX;
 * on Windows it opens with write-at-end which is safe for a single
 * process writer per log file).
 *
 * Any I/O error is swallowed after logging to stderr so that a failure
 * to WRITE the log never takes down the pipeline itself.
 */
export function appendUploadLog(entry: UploadLogEntry): void {
  try {
    const logPath = resolveLogPath();
    ensureLogDir(logPath);
    fs.appendFileSync(logPath, JSON.stringify(entry) + "\n");
  } catch (err) {
    // Deliberately do not throw — losing a log line is preferable to
    // crashing a pipeline stage mid-run.
    // eslint-disable-next-line no-console
    console.error("[upload-log] failed to append entry:", err);
  }
}

/**
 * Read VP_TRIGGER from the process env and coerce to a valid
 * UploadLogTrigger value. Defaults to "cli" so direct PowerShell /
 * tsx invocations without env setup still produce a valid entry.
 */
export function readTriggerFromEnv(): UploadLogTrigger {
  const raw = (process.env.VP_TRIGGER ?? "").toLowerCase();
  if (raw === "manual" || raw === "scheduled") return raw;
  return "cli";
}
