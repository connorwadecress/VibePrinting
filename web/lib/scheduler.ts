/**
 * Per-brand cron scheduler. Lives inside the same Node process as
 * the admin UI and the deletion worker, so there is exactly one
 * timeline for fired jobs.
 *
 * Behavior:
 *   - On {@link startScheduler}, read `data/schedules.json` and
 *     register one node-cron task per enabled brand entry.
 *   - On any change to `data/schedules.json` (fs.watch), tear down
 *     the active task set and rebuild from the new file. This means
 *     the UI's PUT /api/schedule/[brandId] is reflected without a
 *     restart.
 *   - When a task fires, consult the current file again (so a
 *     just-written `globalPaused: true` is honored), check whether
 *     the brand already has an active job, then call job-manager.
 *   - No catch-up after downtime: missed slots are skipped.
 *     Persistent absolute-time semantics are intentionally NOT used
 *     here — that's what the deletion queue is for. Schedules are
 *     "happens at the next matching minute" and that's it.
 *
 * Idempotent: calling startScheduler() twice in the same process is
 * a no-op so HMR / accidental double-init can't double-fire jobs.
 */

import fs from "node:fs";
import cron, { type ScheduledTask } from "node-cron";
import { readSchedules, upsertSchedule, SCHEDULES_FILE_PATH, type ScheduleEntry } from "@/lib/schedule-fs";
import { startRun } from "@/lib/job-manager";
import { hasActiveJobForBrand } from "@/lib/job-store";

let started = false;
const tasks = new Map<string, ScheduledTask>();
let watcher: fs.FSWatcher | null = null;
let reloadTimer: ReturnType<typeof setTimeout> | null = null;

export function startScheduler(): void {
  if (started) return;
  started = true;
  // eslint-disable-next-line no-console
  console.log(`[scheduler] starting (file=${SCHEDULES_FILE_PATH})`);

  reload();

  // Set up the watcher only if the file exists. fs.watch on a
  // missing path throws on some platforms; we re-arm it after the
  // first write lands.
  attachWatcher();
}

export function stopScheduler(): void {
  for (const t of tasks.values()) t.stop();
  tasks.clear();
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  if (reloadTimer) {
    clearTimeout(reloadTimer);
    reloadTimer = null;
  }
  started = false;
}

function attachWatcher(): void {
  if (watcher) return;
  if (!fs.existsSync(SCHEDULES_FILE_PATH)) return;
  try {
    watcher = fs.watch(SCHEDULES_FILE_PATH, { persistent: false }, () => {
      // Debounce: editors often emit two events per save (truncate
      // + write). Coalesce them into a single reload.
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        reloadTimer = null;
        try {
          reload();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[scheduler] reload failed:", err);
        }
      }, 200);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[scheduler] failed to attach watcher:", err);
  }
}

/** Tear down all current tasks and rebuild from the schedules file. */
function reload(): void {
  const data = readSchedules();
  // Stop any tasks for brands that no longer exist in the file.
  for (const [brandId, task] of tasks) {
    if (!data.schedules[brandId]) {
      task.stop();
      tasks.delete(brandId);
      // eslint-disable-next-line no-console
      console.log(`[scheduler] removed ${brandId}`);
    }
  }

  // Stop+restart any task whose entry is enabled. Easier to
  // tear-down-and-rebuild than to diff the cron string.
  for (const [brandId, entry] of Object.entries(data.schedules)) {
    tasks.get(brandId)?.stop();
    tasks.delete(brandId);

    if (data.globalPaused) continue;
    if (!entry.enabled) continue;
    if (!cron.validate(entry.cron)) {
      // eslint-disable-next-line no-console
      console.error(`[scheduler] invalid cron for ${brandId}: ${entry.cron}`);
      continue;
    }
    const task = cron.schedule(
      entry.cron,
      () => {
        onFire(brandId, entry).catch((err) => {
          // eslint-disable-next-line no-console
          console.error(`[scheduler] fire failed for ${brandId}:`, err);
        });
      },
      { timezone: process.env.TZ || undefined },
    );
    tasks.set(brandId, task);
    // eslint-disable-next-line no-console
    console.log(`[scheduler] armed ${brandId} cron="${entry.cron}"`);
  }

  // Re-attach watcher if the file just appeared.
  if (!watcher) attachWatcher();
}

async function onFire(brandId: string, entry: ScheduleEntry): Promise<void> {
  // Re-read so a just-flipped globalPaused is honored even if the
  // watcher hasn't fired the reload yet.
  const fresh = readSchedules();
  if (fresh.globalPaused) {
    // eslint-disable-next-line no-console
    console.log(`[scheduler] skip ${brandId}: globally paused`);
    return;
  }
  const live = fresh.schedules[brandId];
  if (!live || !live.enabled) return;

  if (live.skipIfRunning && hasActiveJobForBrand(brandId)) {
    // eslint-disable-next-line no-console
    console.log(`[scheduler] skip ${brandId}: active job already running`);
    return;
  }

  const schedulerId = `${brandId}@${live.cron}`;
  let result;
  try {
    result = startRun({
      brandId,
      lane: live.lane,
      dryRun: live.dryRun,
      upload: live.platforms.length > 0,
      platforms: live.platforms,
      trigger: "scheduled",
      schedulerId,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[scheduler] startRun failed for ${brandId}:`, err);
    return;
  }
  upsertSchedule(brandId, {
    lastRunAt: new Date().toISOString(),
    lastJobId: result.jobId,
  });
  // eslint-disable-next-line no-console
  console.log(`[scheduler] fired ${brandId} -> ${result.jobId}`);
}
