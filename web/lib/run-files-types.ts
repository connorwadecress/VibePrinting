/**
 * Pure type declarations for the run-files inspector.
 *
 * Kept separate from `run-files.ts` so client components can import
 * the shapes without dragging the server-only `node:fs` / paths
 * implementation through Next's bundler. The HMR error
 * "originalFactory is undefined" is what happens when a "use client"
 * component imports from a module that touches `node:` builtins,
 * even via `import type`.
 */

import type { UploadLogEntry } from "@pipeline/domain/upload-log";

export interface RunFilesStatus {
  /** Resolved absolute path the UI is checking, even if it doesn't exist. */
  runDir: string | null;
  /** Run id parsed from the directory name (`run-YYYYMMDD-HHmmss`). */
  runId: string | null;
  /** True iff `runDir` exists and is a directory. */
  exists: boolean;
  /** True iff `<runDir>/final.mp4` is a regular file. */
  hasFinalMp4: boolean;
  /** Size of final.mp4 in bytes (0 if missing). */
  finalMp4Size: number;
  /** True iff `<runDir>/script.json` is a regular file. */
  hasScript: boolean;
  /**
   * ISO timestamp when the deletion worker is scheduled to remove the
   * run dir, if a pending entry exists in `data/deletion-queue.json`.
   * Null when no upload has succeeded yet (nothing scheduled) or the
   * entry has already been swept.
   */
  deleteAfter: string | null;
  /** Lower-case platform ids that have at least one successful upload. */
  uploadedPlatforms: string[];
  /** Last upload-log entry per platform, success or failure. */
  lastUploads: { platform: string; entry: UploadLogEntry }[];
}

export interface RunFilesPayload {
  status: RunFilesStatus;
  inFlight: { youtube: boolean; tiktok: boolean };
}
