/**
 * Job manager — owns the lifecycle of pipeline child processes.
 *
 * The web UI never imports the pipeline directly. Instead, when a user
 * (or the scheduler) wants to run the pipeline, the job manager spawns
 * `npx tsx src/generate.ts --brand=...` and streams stdout/stderr into
 * the job-store so the SSE endpoint can replay it to the browser.
 *
 * Concurrency policy (global queue):
 *   At most VP_MAX_CONCURRENT_JOBS (default: 1) pipeline processes may
 *   run simultaneously across ALL brands and users. Additional start
 *   requests do NOT throw — they enqueue the job and return a record
 *   with status="queued" and a queuePosition. When a running job
 *   reaches a terminal state, drainQueue() automatically spawns the
 *   next pending job.
 *
 *   Set VP_MAX_CONCURRENT_JOBS=2 (etc.) in the environment to allow
 *   parallel runs if the host has enough resources.
 *
 * Cancellation:
 *   - Running jobs: SIGTERM the child.
 *   - Queued jobs:  removed from the pending queue immediately.
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { ALLOWED_BRANDS } from "@/lib/paths";
import {
  insertJob,
  updateJob,
  appendJobLog,
  hasActiveJobForBrand,
  countRunningJobs,
  getJob,
  type JobRecord,
  type JobTrigger,
} from "@/lib/job-store";

export interface StartRunInput {
  brandId: string;
  lane?: string | null;
  /** When set with lane=null, restrict the random pick to lanes of this type. */
  laneType?: "pexels-api" | "reddit-story";
  dryRun?: boolean;
  upload?: boolean;
  /** Subset of platforms to upload to. Empty array = no upload. */
  platforms?: string[];
  trigger?: JobTrigger;
  schedulerId?: string | null;
  /** Extra env vars to pass to the child (e.g. VP_TOPIC_SEED, VP_REDDIT_POST_URL). */
  envOverrides?: Record<string, string>;
}

export interface StartRunResult {
  jobId: string;
  job: JobRecord;
}

// ---------------------------------------------------------------------------
// Process handles — jobId → child. Used for SIGTERM on cancel.
// ---------------------------------------------------------------------------
const children = new Map<string, ChildProcessWithoutNullStreams>();

// ---------------------------------------------------------------------------
// Global pending queue — anchored on globalThis so all webpack chunks
// share the same instance (same reason as job-store's _vpJobs).
// ---------------------------------------------------------------------------
type QueueEntry = { input: StartRunInput; jobId: string };
type QueueGlobal = { _vpPendingQueue?: QueueEntry[] };
const gq = globalThis as typeof globalThis & QueueGlobal;
if (!gq._vpPendingQueue) gq._vpPendingQueue = [];
const pendingQueue: QueueEntry[] = gq._vpPendingQueue;

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function getMaxConcurrent(): number {
  return Math.max(1, Number(process.env.VP_MAX_CONCURRENT_JOBS ?? "1") || 1);
}

/**
 * Repo root — the directory that contains `src/generate.ts`.
 *
 * In Docker the Next server runs with cwd=`/app` so cwd already is the
 * repo root. In local dev `npm run web:dev` invokes the workspace
 * script, which sets cwd to `web/`, so we walk up until we find
 * `src/generate.ts`. Fall back to cwd so the spawn still produces a
 * recognizable error rather than silently misbehaving.
 */
const REPO_ROOT = (() => {
  let dir = path.resolve(process.cwd());
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, "src", "generate.ts"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(process.cwd());
})();

function newJobId(): string {
  const ts = Date.now().toString(36);
  const rnd = crypto.randomBytes(3).toString("hex");
  return `job_${ts}_${rnd}`;
}

function buildArgs(input: StartRunInput): string[] {
  const args: string[] = ["src/generate.ts", `--brand=${input.brandId}`];
  if (input.lane) args.push(`--lane=${input.lane}`);
  if (input.laneType && !input.lane) args.push(`--lane-type=${input.laneType}`);
  if (input.dryRun) args.push("--dry-run");
  if (input.upload && input.platforms && input.platforms.length > 0) {
    args.push("--upload");
  }
  return args;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Request a pipeline run. If a concurrency slot is available the job
 * is spawned immediately (status transitions queued→running). If all
 * slots are occupied the job is held in the pending queue with
 * status="queued" and a queuePosition until a slot opens up.
 *
 * Never throws due to concurrency — callers always get a JobRecord back.
 */
export function startRun(input: StartRunInput): StartRunResult {
  if (ALLOWED_BRANDS && !ALLOWED_BRANDS.has(input.brandId)) {
    throw new Error(`Brand "${input.brandId}" is not allowed in this instance.`);
  }

  const jobId = newJobId();
  const args = buildArgs(input);
  const trigger = input.trigger ?? "manual";
  const platforms = input.upload ? input.platforms ?? [] : [];

  const record: JobRecord = {
    jobId,
    brandId: input.brandId,
    lane: input.lane ?? null,
    args,
    status: "queued",
    startedAt: new Date().toISOString(),
    logTail: [],
    trigger,
    schedulerId: input.schedulerId ?? null,
    error: null,
  };
  insertJob(record);

  const maxConcurrent = getMaxConcurrent();
  const running = countRunningJobs();

  if (running >= maxConcurrent) {
    // No free slot — enqueue.
    pendingQueue.push({ input, jobId });
    const position = pendingQueue.length;
    updateJob(jobId, { queuePosition: position });
    appendJobLog(
      jobId,
      `[job] queued at position ${position} (running=${running}, max-concurrent=${maxConcurrent})`,
    );
    return { jobId, job: getJob(jobId)! };
  }

  // Slot available — spawn immediately.
  spawnJob(jobId, input, args, trigger, platforms, input.envOverrides);
  return { jobId, job: getJob(jobId)! };
}

/**
 * Cancel a job whether it's running or still in the pending queue.
 * Returns true if anything was actually cancelled.
 */
export function cancelJob(jobId: string): boolean {
  // Check pending queue first.
  const queueIdx = pendingQueue.findIndex((item) => item.jobId === jobId);
  if (queueIdx !== -1) {
    pendingQueue.splice(queueIdx, 1);
    // Renumber remaining positions.
    pendingQueue.forEach((item, i) => updateJob(item.jobId, { queuePosition: i + 1 }));
    updateJob(jobId, {
      status: "cancelled",
      endedAt: new Date().toISOString(),
      error: "cancelled by operator",
      queuePosition: undefined,
    });
    appendJobLog(jobId, `[job] cancelled while queued`);
    return true;
  }

  // Otherwise SIGTERM the child.
  const child = children.get(jobId);
  if (!child) return false;
  // Mark cancelled BEFORE sending the signal so the close handler
  // can read the intent and produce the right terminal status.
  updateJob(jobId, { status: "cancelled" });
  try {
    child.kill("SIGTERM");
  } catch {
    // Already dead; the close handler will still fire.
  }
  return true;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Spawn the pipeline child for a job that has a free concurrency slot.
 * Updates the job record from queued → running.
 */
function spawnJob(
  jobId: string,
  input: StartRunInput,
  args: string[],
  trigger: JobTrigger,
  platforms: string[],
  envOverrides?: Record<string, string>,
): void {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    VP_TRIGGER: trigger,
  };
  if (platforms.length > 0) env.VP_PLATFORMS = platforms.join(",");
  if (input.schedulerId) env.VP_SCHEDULER_ID = input.schedulerId;
  if (envOverrides) {
    for (const [k, v] of Object.entries(envOverrides)) {
      if (v) env[k] = v;
    }
  }

  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn("npx", ["tsx", ...args], {
      cwd: REPO_ROOT,
      env,
      shell: process.platform === "win32", // npx.cmd on Windows
      windowsHide: true,
    });
  } catch (err) {
    updateJob(jobId, {
      status: "failed",
      endedAt: new Date().toISOString(),
      error: `failed to spawn: ${(err as Error).message}`,
      queuePosition: undefined,
    });
    drainQueue();
    throw err;
  }

  children.set(jobId, child);
  updateJob(jobId, { status: "running", pid: child.pid, queuePosition: undefined });
  appendJobLog(jobId, `[job] spawn npx tsx ${args.join(" ")}`);
  if (platforms.length > 0) appendJobLog(jobId, `[job] VP_PLATFORMS=${platforms.join(",")}`);

  attachStream(jobId, child);
}

/**
 * Check if a pending job can be promoted. Called after every terminal
 * state transition so the queue drains automatically.
 */
function drainQueue(): void {
  if (pendingQueue.length === 0) return;
  if (countRunningJobs() >= getMaxConcurrent()) return;

  const next = pendingQueue.shift();
  if (!next) return;

  // Renumber remaining queue positions after the shift.
  pendingQueue.forEach((item, i) => updateJob(item.jobId, { queuePosition: i + 1 }));

  const { input, jobId } = next;
  const job = getJob(jobId);
  if (!job || job.status === "cancelled") {
    // Job was cancelled while waiting — try the next one.
    drainQueue();
    return;
  }

  appendJobLog(jobId, `[job] dequeued — spawning now`);
  const args = buildArgs(input);
  const platforms = input.upload ? input.platforms ?? [] : [];
  const trigger = input.trigger ?? "manual";
  spawnJob(jobId, input, args, trigger, platforms, input.envOverrides);
}

function attachStream(jobId: string, child: ChildProcessWithoutNullStreams): void {
  const splitter = (label: "out" | "err") => {
    let buf = "";
    return (chunk: Buffer) => {
      buf += chunk.toString("utf-8");
      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx).replace(/\r$/, "");
        buf = buf.slice(idx + 1);
        const prefixed = label === "err" ? `[stderr] ${line}` : line;
        appendJobLog(jobId, prefixed);
        // Parse "Run: <id> -> <path>" so the UI knows the run dir.
        const match = line.match(/^\[pipeline\]\s+Run:\s+(\S+)\s+->\s+(.+)$/);
        if (match) {
          updateJob(jobId, { runDir: match[2].trim() });
        }
      }
    };
  };

  child.stdout.on("data", splitter("out"));
  child.stderr.on("data", splitter("err"));

  child.on("error", (err) => {
    appendJobLog(jobId, `[job] error: ${err.message}`);
  });

  child.on("close", (code, signal) => {
    children.delete(jobId);
    const current = getJob(jobId);
    const wasCancelled = current?.status === "cancelled";
    const status = wasCancelled ? "cancelled" : code === 0 ? "success" : "failed";
    const errMessage = wasCancelled
      ? "cancelled by operator"
      : code === 0
        ? null
        : `exited with code ${code}${signal ? ` (signal ${signal})` : ""}`;
    updateJob(jobId, {
      status,
      endedAt: new Date().toISOString(),
      exitCode: code ?? undefined,
      error: errMessage,
    });
    appendJobLog(
      jobId,
      `[job] ${status} (exit=${code ?? "null"}${signal ? `, signal=${signal}` : ""})`,
    );
    // Promote the next waiting job now that this slot is free.
    drainQueue();
  });
}

// Re-export so the scheduler can still call this without importing job-store.
export { hasActiveJobForBrand };
