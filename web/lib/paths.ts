/**
 * Absolute path resolution for the web layer.
 *
 * The admin UI container mounts `brands/`, `output/`, `data/`, and
 * `logs/` from the host. We anchor these to the repo root via this
 * file's own location (web/lib/paths.ts) rather than process.cwd(),
 * because Next dev is launched from the `web/` workspace child (cwd
 * = <root>/web), while in Docker cwd = /app (the repo root). Using
 * import.meta.url makes the resolution identical in both.
 * Every path is overridable via env var so tests and unusual
 * deployments can redirect them without code changes.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

// web/lib/paths.ts -> <repo>/web/lib -> <repo>/web -> <repo>
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const BRANDS_DIR = process.env.VP_BRANDS_DIR ?? path.join(REPO_ROOT, "brands");

/**
 * Optional brand allowlist. When VP_ALLOWED_BRANDS is set (comma-separated
 * brand ids), the UI scopes itself to only those brands — dropdown, runs,
 * schedules, and new job triggers are all filtered. Unset = show everything.
 */
export const ALLOWED_BRANDS: Set<string> | null = process.env.VP_ALLOWED_BRANDS
  ? new Set(process.env.VP_ALLOWED_BRANDS.split(",").map((s) => s.trim()).filter(Boolean))
  : null;
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
