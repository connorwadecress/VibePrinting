/**
 * Atomic IO for `data/schedules.json`.
 *
 * Schedule state lives outside channel.json because it changes
 * operationally (enabled, lastRunAt) at a different cadence than
 * editorial content (lanes, branding). The scheduler reads this
 * file at boot and on every fs.watch fire; the UI writes it via
 * /api/schedule.
 *
 * All writes go through {@link writeSchedules} which serializes via
 * temp+rename so a crashed/half-written file is impossible.
 */

import fs from "node:fs";
import path from "node:path";
import { SCHEDULES_PATH, DATA_DIR } from "@/lib/paths";

export interface ScheduleEntry {
  enabled: boolean;
  /** node-cron expression, e.g. "0 11,15,19 * * *" */
  cron: string;
  /** Lane id, or null = pipeline picks one. */
  lane: string | null;
  /** Subset of platforms to upload to. Empty = no upload. */
  platforms: string[];
  dryRun: boolean;
  /** If true, fire is skipped when an active job already exists for the brand. */
  skipIfRunning: boolean;
  lastRunAt: string | null;
  lastJobId: string | null;
}

export interface SchedulesFile {
  version: 1;
  globalPaused: boolean;
  schedules: Record<string, ScheduleEntry>;
}

const EMPTY: SchedulesFile = {
  version: 1,
  globalPaused: false,
  schedules: {},
};

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Read the schedules file. Missing or unparseable file returns the
 * empty default — operators should never see a hard error from a
 * fresh install.
 */
export function readSchedules(): SchedulesFile {
  if (!fs.existsSync(SCHEDULES_PATH)) return structuredClone(EMPTY);
  try {
    const raw = fs.readFileSync(SCHEDULES_PATH, "utf-8");
    const data = JSON.parse(raw) as SchedulesFile;
    if (!data || typeof data !== "object" || !data.schedules) return structuredClone(EMPTY);
    return data;
  } catch {
    return structuredClone(EMPTY);
  }
}

/** Atomically replace the schedules file. */
export function writeSchedules(data: SchedulesFile): void {
  ensureDataDir();
  const tmp = `${SCHEDULES_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, SCHEDULES_PATH);
}

/** Patch a single brand's entry; create the brand row if missing. */
export function upsertSchedule(brandId: string, patch: Partial<ScheduleEntry>): SchedulesFile {
  const data = readSchedules();
  const existing = data.schedules[brandId] ?? {
    enabled: false,
    cron: "0 11 * * *",
    lane: null,
    platforms: [],
    dryRun: false,
    skipIfRunning: true,
    lastRunAt: null,
    lastJobId: null,
  };
  data.schedules[brandId] = { ...existing, ...patch };
  writeSchedules(data);
  return data;
}

/** Set the global pause flag. */
export function setGlobalPause(paused: boolean): SchedulesFile {
  const data = readSchedules();
  data.globalPaused = paused;
  writeSchedules(data);
  return data;
}

/** Path to the schedules file (for fs.watch). */
export const SCHEDULES_FILE_PATH = path.resolve(SCHEDULES_PATH);
