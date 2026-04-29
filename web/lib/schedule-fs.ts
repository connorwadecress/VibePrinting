/**
 * Atomic IO for `data/schedules.json`.
 *
 * v2 shape: schedules is an ARRAY (not a map). Each brand can have
 * multiple schedules (e.g. one for Reddit-story lanes, one for topic-
 * driven lanes), each with its own cron, laneType, lane, and platforms.
 * The scheduler keys its in-memory task map by schedule id.
 *
 * v1 (single schedule per brand, keyed by brandId) is auto-migrated on
 * read so existing schedules.json files keep working without operator
 * intervention.
 *
 * All writes go through {@link writeSchedules} which uses a temp+rename
 * so a crashed/half-written file is impossible.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { SCHEDULES_PATH, DATA_DIR } from "@/lib/paths";

export type ScheduleLaneType = "pexels-api" | "reddit-story";

export interface ScheduleEntry {
  /** Stable id, generated on creation. */
  id: string;
  /** Brand this schedule belongs to. */
  brandId: string;
  /** Optional human-readable name shown in the editor. */
  name?: string;
  enabled: boolean;
  /** node-cron expression, e.g. "0 11,15,19 * * *" */
  cron: string;
  /** Restrict the random-lane pick to lanes of this type. Null = any type. */
  laneType: ScheduleLaneType | null;
  /** Lane id, or null = pipeline picks one (within laneType if set). */
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
  version: 2;
  globalPaused: boolean;
  schedules: ScheduleEntry[];
}

const EMPTY: SchedulesFile = {
  version: 2,
  globalPaused: false,
  schedules: [],
};

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function newScheduleId(): string {
  return `sched_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
}

interface LegacyV1Entry {
  enabled: boolean;
  cron: string;
  lane: string | null;
  platforms: string[];
  dryRun: boolean;
  skipIfRunning: boolean;
  lastRunAt: string | null;
  lastJobId: string | null;
}

interface LegacyV1File {
  version?: 1;
  globalPaused?: boolean;
  schedules?: Record<string, LegacyV1Entry>;
}

function migrate(raw: unknown): SchedulesFile {
  if (!raw || typeof raw !== "object") return structuredClone(EMPTY);
  const data = raw as { version?: number; globalPaused?: boolean; schedules?: unknown };
  if (data.version === 2 && Array.isArray(data.schedules)) {
    return data as SchedulesFile;
  }
  // v1 shape: schedules is { brandId: entry }. Convert each entry to a
  // v2 array element with a generated id.
  const legacy = raw as LegacyV1File;
  const out: ScheduleEntry[] = [];
  for (const [brandId, entry] of Object.entries(legacy.schedules ?? {})) {
    out.push({
      id: newScheduleId(),
      brandId,
      name: brandId,
      enabled: entry.enabled,
      cron: entry.cron,
      laneType: null,
      lane: entry.lane ?? null,
      platforms: entry.platforms ?? [],
      dryRun: !!entry.dryRun,
      skipIfRunning: entry.skipIfRunning !== false,
      lastRunAt: entry.lastRunAt ?? null,
      lastJobId: entry.lastJobId ?? null,
    });
  }
  return {
    version: 2,
    globalPaused: !!legacy.globalPaused,
    schedules: out,
  };
}

/**
 * Read the schedules file. Missing or unparseable file returns the
 * empty default — operators should never see a hard error from a
 * fresh install. Auto-migrates v1 files to v2 in-memory; the migration
 * is persisted on the next write.
 */
export function readSchedules(): SchedulesFile {
  if (!fs.existsSync(SCHEDULES_PATH)) return structuredClone(EMPTY);
  try {
    const raw = fs.readFileSync(SCHEDULES_PATH, "utf-8");
    return migrate(JSON.parse(raw));
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

/** Replace all schedules for a brand. Other brands' entries are untouched. */
export function replaceBrandSchedules(
  brandId: string,
  entries: ScheduleEntry[],
): SchedulesFile {
  const data = readSchedules();
  const others = data.schedules.filter((s) => s.brandId !== brandId);
  data.schedules = [...others, ...entries];
  writeSchedules(data);
  return data;
}

/** Patch a single schedule by id. Returns the updated file. */
export function updateSchedule(
  scheduleId: string,
  patch: Partial<ScheduleEntry>,
): SchedulesFile {
  const data = readSchedules();
  const idx = data.schedules.findIndex((s) => s.id === scheduleId);
  if (idx === -1) throw new Error(`Schedule "${scheduleId}" not found`);
  data.schedules[idx] = { ...data.schedules[idx], ...patch, id: scheduleId };
  writeSchedules(data);
  return data;
}

/** Delete a schedule by id. */
export function deleteSchedule(scheduleId: string): SchedulesFile {
  const data = readSchedules();
  data.schedules = data.schedules.filter((s) => s.id !== scheduleId);
  writeSchedules(data);
  return data;
}

/** Find a schedule by id (or undefined if missing). */
export function findSchedule(scheduleId: string): ScheduleEntry | undefined {
  return readSchedules().schedules.find((s) => s.id === scheduleId);
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
