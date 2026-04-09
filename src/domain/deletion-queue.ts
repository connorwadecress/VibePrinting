/**
 * Domain types for the persistent deletion queue (data/deletion-queue.json).
 *
 * Written by the pipeline (src/utils/deletion-queue.ts) when an upload
 * succeeds, read and drained by the deletion worker
 * (web/lib/deletion-worker.ts). When an entry's `deleteAfter` is in the
 * past, the worker removes the associated run directory and flips the
 * status to "completed".
 *
 * topic-history.json lives outside the run directory (at
 * brands/<id>/topic-history.json) so it is never touched by cleanup.
 */

import type { UploadResult } from "./interfaces/uploader.js";

export type DeletionStatus = "pending" | "completed" | "failed";

export interface DeletionQueueEntry {
  /** Stable, human-sortable id — `del_<ISO-ts>_<runId>`. */
  id: string;
  /** Absolute path to the run directory that will be removed. */
  runDir: string;
  /** The brand that produced this run. */
  brandId: string;
  /** ISO timestamp at which the entry was enqueued. */
  scheduledAt: string;
  /** ISO timestamp at which the worker is allowed to delete the run. */
  deleteAfter: string;
  /** Uploads that succeeded for this run, captured for audit. */
  uploadResults: UploadResult[];
  /** Pending until swept by the worker. */
  status: DeletionStatus;
  /** ISO timestamp set when the worker finishes (success or failure). */
  completedAt: string | null;
  /** Error message on failure, null otherwise. */
  error: string | null;
}

export interface DeletionQueue {
  version: 1;
  entries: DeletionQueueEntry[];
}

export interface EnqueueDeletionInput {
  runDir: string;
  brandId: string;
  /** Defaults to 30 minutes if omitted. */
  delayMinutes?: number;
  /** Successful upload results for audit. */
  uploadResults: UploadResult[];
}

export const EMPTY_DELETION_QUEUE: DeletionQueue = {
  version: 1,
  entries: [],
};
