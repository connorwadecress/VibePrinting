/**
 * Persistent deletion queue — read, write, enqueue.
 *
 * This module is the single source of truth for the on-disk queue file
 * at data/deletion-queue.json (overridable via DELETION_QUEUE_PATH).
 *
 * Writers: the pipeline's UploadStage calls {@link enqueueDeletion}
 * after a successful upload. The deletion worker
 * (web/lib/deletion-worker.ts) reads, mutates, and writes the queue
 * each tick. Both writers use the same atomic write-rename helper.
 *
 * The queue is a single small JSON file; the write cadence is low
 * enough that synchronous fs is fine and avoids any lock coordination.
 */

import fs from "node:fs";
import path from "node:path";
import type {
  DeletionQueue,
  DeletionQueueEntry,
  EnqueueDeletionInput,
} from "../domain/deletion-queue.js";
import { EMPTY_DELETION_QUEUE } from "../domain/deletion-queue.js";

export const DEFAULT_DELAY_MINUTES = 30;

function resolveQueuePath(): string {
  return (
    process.env.DELETION_QUEUE_PATH ??
    path.resolve(process.cwd(), "data", "deletion-queue.json")
  );
}

function ensureQueueDir(queuePath: string): void {
  const dir = path.dirname(queuePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Read the queue file. Returns an empty queue if the file does not
 * exist or cannot be parsed (we prefer a clean slate over a crash).
 */
export function readQueue(): DeletionQueue {
  const queuePath = resolveQueuePath();
  if (!fs.existsSync(queuePath)) {
    return { ...EMPTY_DELETION_QUEUE };
  }
  try {
    const raw = fs.readFileSync(queuePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<DeletionQueue>;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.entries)) {
      return { ...EMPTY_DELETION_QUEUE };
    }
    return { version: 1, entries: parsed.entries };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[deletion-queue] failed to parse queue file — starting fresh:", err);
    return { ...EMPTY_DELETION_QUEUE };
  }
}

/**
 * Atomically write the queue file via temp-then-rename. Safe as long
 * as only one process writes at a time; the pipeline and worker both
 * live inside the same host, so contention is bounded by the per-brand
 * job serializer.
 */
export function writeQueue(queue: DeletionQueue): void {
  const queuePath = resolveQueuePath();
  ensureQueueDir(queuePath);
  const tmp = `${queuePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(queue, null, 2));
  fs.renameSync(tmp, queuePath);
}

/**
 * Build a stable id for an entry — sortable by creation time.
 */
function buildEntryId(runDir: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `del_${ts}_${path.basename(runDir)}`;
}

/**
 * Enqueue a run directory for deletion. Safe to call multiple times;
 * a duplicate runDir with status "pending" is detected and skipped.
 * I/O failures are swallowed after logging to stderr so that losing
 * an enqueue never crashes the pipeline.
 */
export function enqueueDeletion(input: EnqueueDeletionInput): DeletionQueueEntry | null {
  try {
    const delayMinutes = input.delayMinutes ?? DEFAULT_DELAY_MINUTES;
    const now = new Date();
    const deleteAfter = new Date(now.getTime() + delayMinutes * 60 * 1000);

    const queue = readQueue();

    // Idempotency: if we already have a pending entry for this exact
    // run directory, do not enqueue a second one.
    const existing = queue.entries.find(
      (e) => e.status === "pending" && path.resolve(e.runDir) === path.resolve(input.runDir),
    );
    if (existing) return existing;

    const entry: DeletionQueueEntry = {
      id: buildEntryId(input.runDir),
      runDir: path.resolve(input.runDir),
      brandId: input.brandId,
      scheduledAt: now.toISOString(),
      deleteAfter: deleteAfter.toISOString(),
      uploadResults: input.uploadResults,
      status: "pending",
      completedAt: null,
      error: null,
    };

    queue.entries.push(entry);
    writeQueue(queue);
    return entry;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[deletion-queue] failed to enqueue:", err);
    return null;
  }
}

/**
 * Return the file path the queue lives at — useful for tooling and
 * the admin UI diagnostic panel.
 */
export function getQueuePath(): string {
  return resolveQueuePath();
}
