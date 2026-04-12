/**
 * In-memory job registry with on-disk snapshot.
 *
 * The job store is the single source of truth for "what runs are
 * happening right now and what just finished". The web layer reads
 * from it; the {@link JobManager} writes to it. We snapshot to
 * `data/jobs.json` after every transition so a process restart can
 * recover history (and mark formerly-running jobs as failed).
 *
 * The store is intentionally process-local: there is exactly one Node
 * process serving the admin UI, the scheduler, and the deletion
 * worker. No multi-instance coordination is required.
 */

import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import { JOBS_PATH, DATA_DIR, ALLOWED_BRANDS } from "@/lib/paths";
import type { UploadResult } from "@pipeline/domain/interfaces/uploader";

export type JobStatus = "queued" | "running" | "success" | "failed" | "cancelled";
export type JobTrigger = "manual" | "scheduled" | "cli";

export interface JobRecord {
  jobId: string;
  brandId: string;
  lane: string | null;
  args: string[];
  status: JobStatus;
  startedAt: string;
  endedAt?: string;
  pid?: number;
  exitCode?: number;
  runDir?: string;
  uploadResults?: UploadResult[];
  /** 500-line ring buffer of stdout/stderr lines, oldest first. */
  logTail: string[];
  trigger: JobTrigger;
  schedulerId?: string | null;
  error?: string | null;
  /**
   * 1-based position in the global pending queue. Present only while
   * the job is waiting for a concurrency slot (status === "queued").
   * Cleared (set to undefined) when the job is actually spawned.
   */
  queuePosition?: number;
}

const MAX_LOG_LINES = 500;
const MAX_HISTORY = 200;

interface JobsSnapshot {
  version: 1;
  jobs: JobRecord[];
}

// ---------------------------------------------------------------------------
// Singleton state via globalThis.
//
// Next.js webpack bundles this file into separate chunks for different
// server contexts (instrumentation vs API routes). Each chunk normally gets
// its own module-level variables, meaning the scheduler and the API routes
// end up with *different* Map instances — jobs created by the scheduler are
// invisible to the API layer and vice versa.
//
// Anchoring the Maps on globalThis ensures every chunk that imports
// job-store shares the exact same registry, regardless of how many times
// webpack instantiates this module.
// ---------------------------------------------------------------------------
type StoreGlobal = {
  _vpJobs?: Map<string, JobRecord>;
  _vpBuses?: Map<string, EventEmitter>;
  _vpLoaded?: boolean;
};
const g = globalThis as typeof globalThis & StoreGlobal;
if (!g._vpJobs) g._vpJobs = new Map<string, JobRecord>();
if (!g._vpBuses) g._vpBuses = new Map<string, EventEmitter>();
if (g._vpLoaded === undefined) g._vpLoaded = false;

/** In-memory map. JobId -> record. */
const jobs: Map<string, JobRecord> = g._vpJobs;

/** Per-job event bus for live SSE streaming. */
const buses: Map<string, EventEmitter> = g._vpBuses;

function getLoaded(): boolean { return g._vpLoaded === true; }
function setLoaded(): void { g._vpLoaded = true; }

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function snapshot(): void {
  ensureDataDir();
  const list = Array.from(jobs.values()).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  // Keep the snapshot bounded so the file does not grow forever.
  const trimmed = list.slice(0, MAX_HISTORY);
  const data: JobsSnapshot = { version: 1, jobs: trimmed };
  const tmp = `${JOBS_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, JOBS_PATH);
}

/**
 * Lazy-load the snapshot from disk on first access. Any job that was
 * still marked `running` or `queued` is treated as orphaned (the
 * process must have died mid-run) and flipped to `failed`.
 */
function ensureLoaded(): void {
  if (getLoaded()) return;
  setLoaded();
  if (!fs.existsSync(JOBS_PATH)) return;
  try {
    const raw = fs.readFileSync(JOBS_PATH, "utf-8");
    const data = JSON.parse(raw) as JobsSnapshot;
    if (!Array.isArray(data?.jobs)) return;
    const now = new Date().toISOString();
    let hadOrphans = false;
    for (const job of data.jobs) {
      if (job.status === "running" || job.status === "queued") {
        job.status = "failed";
        job.endedAt = now;
        job.error = "container restarted while job was running";
        hadOrphans = true;
      }
      jobs.set(job.jobId, job);
    }
    // Write the corrected state back so disk matches memory immediately.
    // Without this, jobs.json still shows "running" until the next write.
    if (hadOrphans) snapshot();
  } catch {
    // Corrupt snapshot — start fresh rather than crash the UI.
  }
}

function busFor(jobId: string): EventEmitter {
  let bus = buses.get(jobId);
  if (!bus) {
    bus = new EventEmitter();
    bus.setMaxListeners(0);
    buses.set(jobId, bus);
  }
  return bus;
}

/** Insert a brand-new record. Caller must mutate via {@link updateJob}. */
export function insertJob(job: JobRecord): void {
  ensureLoaded();
  jobs.set(job.jobId, job);
  snapshot();
  busFor(job.jobId).emit("update", job);
}

/** Patch a job by id. Returns the new record, or null if unknown. */
export function updateJob(jobId: string, patch: Partial<JobRecord>): JobRecord | null {
  ensureLoaded();
  const current = jobs.get(jobId);
  if (!current) return null;
  Object.assign(current, patch);
  snapshot();
  busFor(jobId).emit("update", current);
  return current;
}

/** Append a log line to a job's ring buffer and emit it on the bus. */
export function appendJobLog(jobId: string, line: string): void {
  ensureLoaded();
  const current = jobs.get(jobId);
  if (!current) return;
  current.logTail.push(line);
  if (current.logTail.length > MAX_LOG_LINES) {
    current.logTail.splice(0, current.logTail.length - MAX_LOG_LINES);
  }
  // We do not snapshot on every log line — too noisy. The next
  // status transition will persist whatever tail we have.
  busFor(jobId).emit("log", line);
}

export function getJob(jobId: string): JobRecord | null {
  ensureLoaded();
  return jobs.get(jobId) ?? null;
}

export function listJobs(): JobRecord[] {
  ensureLoaded();
  const all = Array.from(jobs.values()).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  if (ALLOWED_BRANDS) return all.filter((j) => ALLOWED_BRANDS!.has(j.brandId));
  return all;
}

export function listActiveJobs(): JobRecord[] {
  return listJobs().filter((j) => j.status === "queued" || j.status === "running");
}

export function hasActiveJobForBrand(brandId: string): boolean {
  return listActiveJobs().some((j) => j.brandId === brandId);
}

/** Count jobs that are actively running (not just queued/pending). */
export function countRunningJobs(): number {
  ensureLoaded();
  let count = 0;
  for (const j of jobs.values()) {
    if (j.status === "running") count++;
  }
  return count;
}

/**
 * Subscribe to log + status events for a job. Returns an unsubscribe
 * function. The caller is responsible for replaying any prior log
 * lines via {@link getJob}().logTail before attaching the listener.
 */
export function subscribeJob(
  jobId: string,
  onLog: (line: string) => void,
  onUpdate: (job: JobRecord) => void,
): () => void {
  const bus = busFor(jobId);
  bus.on("log", onLog);
  bus.on("update", onUpdate);
  return () => {
    bus.off("log", onLog);
    bus.off("update", onUpdate);
  };
}

/** Force-reload from disk. Test helper. */
export function _resetForTests(): void {
  jobs.clear();
  buses.clear();
  g._vpLoaded = false;
}

// Path is exported so other modules can reference where snapshots live.
export const SNAPSHOT_PATH = path.resolve(JOBS_PATH);
