/**
 * Reverse reader for the upload log JSONL file.
 *
 * The upload log grows append-only at logs/upload-log.jsonl. The
 * admin UI wants the most recent N entries (optionally filtered by
 * brand) and never wants to load the whole file into memory. We
 * read the tail of the file in fixed-size chunks, scan for line
 * boundaries, and parse JSON in newest-first order until we have
 * enough entries.
 *
 * Edge cases:
 *   - Missing file: return [].
 *   - Corrupt line: skip silently. The pipeline writes atomically
 *     per-line so partial-write corruption is unlikely, but old
 *     debugging tools have been known to leave junk lines.
 *   - File smaller than the chunk size: read once from offset 0.
 *
 * No watch / no streaming. The UI hits this on every page load and
 * that is fine — the file is small (~350 bytes/line × 10/day).
 */

import fs from "node:fs";
import { UPLOAD_LOG_PATH } from "@/lib/paths";
import type { UploadLogEntry } from "@pipeline/domain/upload-log";

const CHUNK_SIZE = 16 * 1024;

export interface ReadOptions {
  /** Restrict to a single brand. */
  brand?: string;
  /** Maximum entries to return. Defaults to 100. */
  limit?: number;
}

/**
 * Return up to `limit` upload log entries, newest first, optionally
 * filtered by brand.
 */
export function readUploadLog(opts: ReadOptions = {}): UploadLogEntry[] {
  const limit = Math.max(1, Math.min(1000, opts.limit ?? 100));
  const brand = opts.brand?.trim() || null;

  if (!fs.existsSync(UPLOAD_LOG_PATH)) return [];

  let fd: number;
  try {
    fd = fs.openSync(UPLOAD_LOG_PATH, "r");
  } catch {
    return [];
  }
  try {
    const stats = fs.fstatSync(fd);
    let position = stats.size;
    const out: UploadLogEntry[] = [];
    let leftover = "";

    while (position > 0 && out.length < limit) {
      const readSize = Math.min(CHUNK_SIZE, position);
      position -= readSize;
      const buf = Buffer.alloc(readSize);
      fs.readSync(fd, buf, 0, readSize, position);
      const chunk = buf.toString("utf-8") + leftover;

      // Split into lines. The first piece may be a partial line that
      // we hold over for the next iteration (which reads the bytes
      // immediately preceding it).
      const newlineIdx = chunk.indexOf("\n");
      if (position === 0 || newlineIdx === -1) {
        // We have read all the way to the start: every line in
        // `chunk` is complete.
        leftover = "";
        consumeLinesNewestFirst(chunk, brand, out, limit);
      } else {
        leftover = chunk.slice(0, newlineIdx);
        const completeBlock = chunk.slice(newlineIdx + 1);
        consumeLinesNewestFirst(completeBlock, brand, out, limit);
      }
    }

    // Final flush of any held-over partial-line content (only happens
    // if the loop ended without reading position=0, which it should
    // not — but defensively handle it).
    if (out.length < limit && leftover.length > 0) {
      consumeLinesNewestFirst(leftover, brand, out, limit);
    }

    return out;
  } finally {
    try { fs.closeSync(fd); } catch {}
  }
}

function consumeLinesNewestFirst(
  block: string,
  brand: string | null,
  out: UploadLogEntry[],
  limit: number,
): void {
  const lines = block.split("\n");
  // Process from the bottom (most recent) up to the top of the chunk.
  for (let i = lines.length - 1; i >= 0; i--) {
    if (out.length >= limit) return;
    const line = lines[i].trim();
    if (!line) continue;
    let parsed: UploadLogEntry;
    try {
      parsed = JSON.parse(line) as UploadLogEntry;
    } catch {
      continue; // skip corrupt
    }
    if (brand && parsed.brandId !== brand) continue;
    out.push(parsed);
  }
}

/**
 * Quickly enumerate the distinct brand ids that appear in the log.
 * The brand filter dropdown uses this so it never shows a brand the
 * user has no entries for.
 */
export function listLoggedBrands(): string[] {
  const seen = new Set<string>();
  for (const entry of readUploadLog({ limit: 1000 })) {
    if (entry.brandId) seen.add(entry.brandId);
  }
  return Array.from(seen).sort();
}
