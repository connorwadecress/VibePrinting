/**
 * Job manager — owns the lifecycle of pipeline child processes.
 *
 * The web UI never imports the pipeline directly. Instead, when a
 * user (or the scheduler) wants to run the pipeline, the job manager
 * spawns `npx tsx src/generate.ts --brand=...` and streams the
 * child's stdout/stderr into the {@link job-store} so the SSE
 * endpoint can replay it to the browser.
 *
 * Concurrency policy:
 *   - At most one active job per brand. Additional starts for the
 *     same brand are rejected with a clear error message; the UI is
 *     responsible for surfacing it. (We do NOT queue them — the
 *     scheduler decides whether to skip or wait.)
 *
 * Cancellation: SIGTERM the child. The pipeline does not have a
 * graceful drain — that's fine for now; partial run dirs are not
 * a problem because nothing has been uploaded yet.
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import crypto from "node:crypto";
import {
  insertJob,
  updateJob,
  appendJobLog,
  hasActiveJobForBrand,
  getJob,
  type JobRecord,
  type JobTrigger,
} from "@/lib/job-store";

export interface StartRunInput {
  brandId: string;
  lane?: string | null;
  dryRun?: boolean;
  upload?: boolean;
  /** Subset of platforms to upload to. Empty array = no upload. */
  platforms?: string[];
  trigger?: JobTrigger;
  schedulerId?: string | null;
}

export interface StartRunResult {
  jobId: string;
  job: JobRecord;
}

/** PID -> child handle. Used so /api/runs/[jobId]/cancel can SIGTERM it. */
const children = new Map<string, ChildProcessWithoutNullStreams>();

/** Repo root — derived from cwd at module load. */
const REPO_ROOT = path.resolve(process.cwd());

function newJobId(): string {
  // job_<base36 epoch>_<6 hex>
  const ts = Date.now().toString(36);
  const rnd = crypto.randomBytes(3).toString("hex");
  return `job_${ts}_${rnd}`;
}

function buildArgs(input: StartRunInput): string[] {
  const args: string[] = ["src/generate.ts", `--brand=${input.brandId}`];
  if (input.lane) args.push(`--lane=${input.lane}`);
  if (input.dryRun) args.push("--dry-run");
  if (input.upload && input.platforms && input.platforms.length > 0) {
    args.push("--upload");
  }
  return args;
}

/**
 * Spawn a pipeline run. Synchronous bookkeeping (job-store insert,
 * concurrency check) happens before the child returns; the child
 * itself runs in the background and updates the store via its
 * stdout/stderr listeners.
 *
 * Returns the JobRecord at the moment of spawn. The caller (HTTP
 * handler) typically redirects the user to /runs/[jobId] where the
 * SSE stream takes over.
 */
export function startRun(input: StartRunInput): StartRunResult {
  if (hasActiveJobForBrand(input.brandId)) {
    throw new Error(`A run is already in progress for brand "${input.brandId}".`);
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

  // Spawn `npx tsx src/generate.ts ...` from the repo root so the
  // pipeline finds brands/, output/, .env, etc. relative to cwd.
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    VP_TRIGGER: trigger,
  };
  if (platforms.length > 0) env.VP_PLATFORMS = platforms.join(",");
  if (input.schedulerId) env.VP_SCHEDULER_ID = input.schedulerId;

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
    });
    throw err;
  }

  children.set(jobId, child);
  updateJob(jobId, { status: "running", pid: child.pid });
  appendJobLog(jobId, `[job] spawn npx tsx ${args.join(" ")}`);
  if (platforms.length > 0) appendJobLog(jobId, `[job] VP_PLATFORMS=${platforms.join(",")}`);

  attachStream(jobId, child);

  return { jobId, job: getJob(jobId)! };
}

function attachStream(jobId: string, child: ChildProcessWithoutNullStreams): void {
  // Buffered line splitter — stdout chunks aren't line-aligned.
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
    const status = wasCancelled
      ? "cancelled"
      : code === 0
        ? "success"
        : "failed";
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
    appendJobLog(jobId, `[job] ${status} (exit=${code ?? "null"}${signal ? `, signal=${signal}` : ""})`);
  });
}

/**
 * Cancel a running job. Returns true if a SIGTERM was actually sent.
 * No-ops if the job is already in a terminal state.
 */
export function cancelJob(jobId: string): boolean {
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
