/**
 * Deletion worker — sweeps the persistent deletion queue and removes
 * run directories whose `deleteAfter` timestamp is in the past.
 *
 * Runs in two modes:
 *
 *   1. Embedded inside the admin UI Node process. `web/boot.ts` calls
 *      {@link startDeletionWorker} once, and an interval ticker drives
 *      the sweep every 60 seconds. Phase 6 wires this up.
 *
 *   2. Standalone from the command line for development and Phase 2
 *      verification:
 *
 *          npx tsx web/lib/deletion-worker.ts
 *
 *      The ESM main-module guard at the bottom detects direct
 *      invocation and keeps the process alive so the interval keeps
 *      firing until Ctrl+C.
 *
 * Absolute ISO `deleteAfter` timestamps mean restart or downtime can
 * only ever delay a deletion — never re-arm or skip it. An immediate
 * sweep runs on boot to catch anything that matured while the process
 * was down.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DeletionQueueEntry } from "@pipeline/domain/deletion-queue";
import {
  getQueuePath,
  readQueue,
  writeQueue,
} from "@pipeline/utils/deletion-queue";

/** How often the sweep runs when embedded. */
const TICK_MS = 60_000;

/** Entries in terminal states older than this many days are pruned. */
const PRUNE_AFTER_DAYS = 7;

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let started = false;

/**
 * Start the deletion worker. Idempotent — calling it twice in the same
 * process is a no-op. The first sweep runs immediately so that any
 * entries whose `deleteAfter` was missed during container downtime are
 * cleaned up as soon as possible.
 */
export function startDeletionWorker(options?: { tickMs?: number }): void {
  if (started) return;
  started = true;

  const tickMs = options?.tickMs ?? TICK_MS;
  // eslint-disable-next-line no-console
  console.log(`[deletion-worker] starting (queue=${getQueuePath()}, tickMs=${tickMs})`);

  // Fire once immediately, then on an interval.
  tick().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[deletion-worker] initial sweep failed:", err);
  });

  intervalHandle = setInterval(() => {
    tick().catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[deletion-worker] sweep failed:", err);
    });
  }, tickMs);

  // Don't keep the Node event loop alive just for the ticker when the
  // process has nothing else to do — but DO keep it alive in standalone
  // mode (see main block below, which resumes stdin).
  if (typeof intervalHandle.unref === "function") intervalHandle.unref();
}

/**
 * Stop the deletion worker. Useful for tests and hot-reload scenarios.
 */
export function stopDeletionWorker(): void {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  started = false;
}

/**
 * One sweep: scan pending entries, delete those whose deleteAfter is
 * in the past, and prune ancient terminal entries.
 */
export async function tick(): Promise<{ deleted: number; failed: number; pruned: number }> {
  const queue = readQueue();
  const now = Date.now();
  let mutated = false;
  let deleted = 0;
  let failed = 0;

  for (const entry of queue.entries) {
    if (entry.status !== "pending") continue;
    if (Date.parse(entry.deleteAfter) > now) continue;

    try {
      await applyDeletion(entry);
      entry.status = "completed";
      entry.completedAt = new Date().toISOString();
      deleted++;
      // eslint-disable-next-line no-console
      console.log(`[deletion-worker] deleted ${entry.runDir}`);
    } catch (err) {
      entry.status = "failed";
      entry.completedAt = new Date().toISOString();
      entry.error = (err as Error).message ?? String(err);
      failed++;
      // eslint-disable-next-line no-console
      console.error(`[deletion-worker] failed to delete ${entry.runDir}:`, err);
    }
    mutated = true;
  }

  // Prune terminal entries older than PRUNE_AFTER_DAYS so the queue
  // file doesn't grow forever.
  const pruneCutoff = now - PRUNE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const beforePrune = queue.entries.length;
  queue.entries = queue.entries.filter((e) => {
    if (e.status === "pending") return true;
    if (!e.completedAt) return true;
    return Date.parse(e.completedAt) >= pruneCutoff;
  });
  const pruned = beforePrune - queue.entries.length;
  if (pruned > 0) mutated = true;

  if (mutated) writeQueue(queue);

  return { deleted, failed, pruned };
}

/**
 * Delete one run directory recursively. `force: true` swallows "file
 * not found" so a stale queue entry (directory already gone) is not
 * reported as a failure.
 */
async function applyDeletion(entry: DeletionQueueEntry): Promise<void> {
  const target = path.resolve(entry.runDir);
  if (!fs.existsSync(target)) return; // already gone; treat as success
  await fs.promises.rm(target, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Standalone CLI entrypoint
// ---------------------------------------------------------------------------

function isDirectRun(): boolean {
  if (!process.argv[1]) return false;
  try {
    const invoked = path.resolve(process.argv[1]);
    const self = path.resolve(fileURLToPath(import.meta.url));
    return invoked === self;
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  // eslint-disable-next-line no-console
  console.log("[deletion-worker] running standalone — Ctrl+C to stop");
  startDeletionWorker();
  // Keep the event loop alive. setInterval alone uses .unref() so we
  // need another handle.
  const keepalive = setInterval(() => {}, 1 << 30);
  const shutdown = () => {
    clearInterval(keepalive);
    stopDeletionWorker();
    // eslint-disable-next-line no-console
    console.log("[deletion-worker] stopped");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
