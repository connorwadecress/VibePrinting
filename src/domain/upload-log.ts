/**
 * Domain shape for the persistent upload log (logs/upload-log.jsonl).
 *
 * One line per upload attempt, per platform, per pipeline run. Written
 * by both the main pipeline (src/pipeline/stages/upload.ts) and the
 * retry-upload CLI (src/retry-upload.ts). Consumed by the admin UI's
 * upload history view.
 *
 * The file format is JSONL: one JSON object per line, newline-terminated.
 * This type must match the JSON shape exactly — any change requires a
 * `version` bump on new entries if the admin UI starts using one.
 */

export type UploadLogStatus = "success" | "failure";

/**
 * What initiated the run that produced this upload attempt.
 * - "manual":   operator clicked the Trigger Run button in the UI
 * - "scheduled": post-frequency scheduler fired this run
 * - "cli":      PowerShell wrapper, retry-upload, or direct tsx call
 */
export type UploadLogTrigger = "manual" | "scheduled" | "cli";

export interface UploadLogEntry {
  /** ISO 8601 timestamp at which the upload promise settled. */
  ts: string;
  /** The run directory name (e.g. "run-20260407-140005"). */
  runId: string;
  /** The brand ID that produced this run (e.g. "signal-drop"). */
  brandId: string;
  /** The content lane ID used for this run, or null if unknown. */
  lane: string | null;
  /** Lower-case platform identifier (e.g. "youtube", "tiktok"). */
  platform: string;
  /** Whether the upload succeeded or failed. */
  status: UploadLogStatus;
  /** Platform-assigned ID on success, null on failure. */
  videoId: string | null;
  /** Public URL on success, null on failure. */
  url: string | null;
  /** Title actually uploaded, null on failure. */
  title: string | null;
  /** Milliseconds from the moment the upload was kicked off to settlement. */
  durationMs: number;
  /** Size of the uploaded file in bytes at the moment the attempt started. */
  fileSizeBytes: number;
  /** Error message on failure, null on success. */
  error: string | null;
  /** What initiated the run that produced this upload attempt. */
  trigger: UploadLogTrigger;
  /** Scheduler identifier when trigger === "scheduled", null otherwise. */
  schedulerId: string | null;
}
