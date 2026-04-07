/**
 * Absolute path resolution for the web layer.
 *
 * The admin UI container mounts `brands/`, `output/`, `data/`, and
 * `logs/` from the host. We resolve those via process.cwd() (the
 * repo root when running `npm run web:dev`, `/app` inside Docker).
 * Every path is overridable via env var so tests and unusual
 * deployments can redirect them without code changes.
 */

import path from "node:path";

const REPO_ROOT = path.resolve(process.cwd());

export const BRANDS_DIR = process.env.VP_BRANDS_DIR ?? path.join(REPO_ROOT, "brands");
export const OUTPUT_DIR = process.env.VP_OUTPUT_DIR ?? process.env.OUTPUT_DIR ?? path.join(REPO_ROOT, "output");
export const DATA_DIR = process.env.VP_DATA_DIR ?? path.join(REPO_ROOT, "data");
export const LOGS_DIR = process.env.VP_LOGS_DIR ?? path.join(REPO_ROOT, "logs");

export const UPLOAD_LOG_PATH = process.env.UPLOAD_LOG_PATH ?? path.join(LOGS_DIR, "upload-log.jsonl");
export const DELETION_QUEUE_PATH = process.env.DELETION_QUEUE_PATH ?? path.join(DATA_DIR, "deletion-queue.json");
export const SCHEDULES_PATH = process.env.VP_SCHEDULES_PATH ?? path.join(DATA_DIR, "schedules.json");
export const JOBS_PATH = process.env.VP_JOBS_PATH ?? path.join(DATA_DIR, "jobs.json");

/** Path to a specific brand's channel.json. */
export function brandProfilePath(brandId: string): string {
  return path.join(BRANDS_DIR, brandId, "channel.json");
}

/** Path to a specific brand's topic-history.json. */
export function brandTopicHistoryPath(brandId: string): string {
  return path.join(BRANDS_DIR, brandId, "topic-history.json");
}

/** Path to a specific brand folder. */
export function brandDir(brandId: string): string {
  return path.join(BRANDS_DIR, brandId);
}
