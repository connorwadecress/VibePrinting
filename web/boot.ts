/**
 * Process-wide initialization for background workers.
 *
 * Imported once by web/instrumentation.ts (Next's init hook). The
 * boot module guards against double-init via module-level state in
 * each worker (startDeletionWorker / startScheduler are themselves
 * idempotent), so HMR or accidental re-imports cannot spawn two
 * tickers.
 *
 * The work happens in two child modules so they remain individually
 * runnable in tests and standalone CLI mode.
 */

import { startDeletionWorker } from "@/lib/deletion-worker";
import { startScheduler } from "@/lib/scheduler";

let booted = false;

export function boot(): void {
  if (booted) return;
  booted = true;
  // eslint-disable-next-line no-console
  console.log("[boot] starting background workers");
  try {
    startDeletionWorker();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[boot] deletion worker failed to start:", err);
  }
  try {
    startScheduler();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[boot] scheduler failed to start:", err);
  }
}
