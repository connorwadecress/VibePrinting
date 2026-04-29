/**
 * Server-side helpers for the cross-brand shared asset library.
 *
 * The library lives at <repo>/shared/{gameplay,music} (overridable via
 * VP_SHARED_DIR). Every brand on the instance reads from the same pool;
 * per-brand customization is the AssetEntry[] allowlist in each
 * channel.json. Files are managed via the admin UI's /library page.
 *
 * This module never touches channel.json — it just owns the on-disk
 * pool. All filename inputs from HTTP are sanitized via path.basename
 * to defeat traversal attempts before they touch the filesystem.
 */

import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import {
  SHARED_GAMEPLAY_DIR,
  SHARED_MUSIC_DIR,
} from "@/lib/paths";
import { GAMEPLAY_EXTS, MUSIC_EXTS } from "@/lib/brand-io";

export type LibraryKind = "gameplay" | "music";

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500MB per file

export interface LibraryEntry {
  filename: string;
  sizeBytes: number;
  modifiedMs: number;
}

export function isLibraryKind(value: unknown): value is LibraryKind {
  return value === "gameplay" || value === "music";
}

export function libraryDirFor(kind: LibraryKind): string {
  return kind === "gameplay" ? SHARED_GAMEPLAY_DIR : SHARED_MUSIC_DIR;
}

export function allowedExtsFor(kind: LibraryKind): readonly string[] {
  return kind === "gameplay" ? GAMEPLAY_EXTS : MUSIC_EXTS;
}

/**
 * List entries currently on disk for a library kind. Missing dir = [].
 * Sorted alphabetically; tweak in the UI layer if a different order
 * matters for presentation.
 */
export function listLibrary(kind: LibraryKind): LibraryEntry[] {
  const dir = libraryDirFor(kind);
  const exts = allowedExtsFor(kind);
  if (!fs.existsSync(dir)) return [];
  const out: LibraryEntry[] = [];
  for (const name of fs.readdirSync(dir)) {
    if (!exts.includes(path.extname(name).toLowerCase())) continue;
    try {
      const stat = fs.statSync(path.join(dir, name));
      if (!stat.isFile()) continue;
      out.push({
        filename: name,
        sizeBytes: stat.size,
        modifiedMs: stat.mtimeMs,
      });
    } catch {
      // Skip unreadable entries silently — dir listings should never throw.
    }
  }
  out.sort((a, b) => a.filename.localeCompare(b.filename));
  return out;
}

/**
 * Strip every path-y character from an incoming filename so we cannot
 * be tricked into writing outside the library dir, then verify the
 * extension is on the whitelist for this kind.
 *
 * Returns the safe basename, or null if the input is invalid for any
 * reason (empty, traversal, control chars, wrong extension).
 */
export function sanitizeUploadFilename(
  raw: string,
  kind: LibraryKind,
): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  // path.basename collapses any traversal — "../../etc/passwd" -> "passwd".
  // We additionally reject explicit separators to be defensive on Windows.
  const base = path.basename(raw).trim();
  if (!base || base === "." || base === "..") return null;
  if (base.includes("/") || base.includes("\\")) return null;
  // Disallow ASCII control chars (0x00-0x1f) and DEL (0x7f).
  for (let i = 0; i < base.length; i++) {
    const code = base.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return null;
  }
  const ext = path.extname(base).toLowerCase();
  if (!allowedExtsFor(kind).includes(ext)) return null;
  return base;
}

/**
 * Stream a Web Fetch File body to disk inside the library dir. Aborts
 * + cleans up the partial file if the byte cap is exceeded. Returns
 * the absolute path written.
 */
export async function writeLibraryUpload(
  kind: LibraryKind,
  file: File,
): Promise<{ filename: string; absPath: string; sizeBytes: number }> {
  const safeName = sanitizeUploadFilename(file.name, kind);
  if (!safeName) {
    throw new Error("invalid_filename");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("file_too_large");
  }
  const dir = libraryDirFor(kind);
  fs.mkdirSync(dir, { recursive: true });

  const absPath = path.join(dir, safeName);
  const tmpPath = `${absPath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Stream via node:stream to keep memory bounded for large videos.
  const ws = fs.createWriteStream(tmpPath);
  let bytes = 0;
  try {
    // file.stream() returns a Web ReadableStream; Readable.fromWeb adapts it.
    const readable = Readable.fromWeb(
      file.stream() as unknown as Parameters<typeof Readable.fromWeb>[0],
    );
    await new Promise<void>((resolve, reject) => {
      readable.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_UPLOAD_BYTES) {
          readable.destroy(new Error("file_too_large"));
          return;
        }
      });
      readable.on("error", reject);
      ws.on("error", reject);
      ws.on("finish", () => resolve());
      readable.pipe(ws);
    });
    fs.renameSync(tmpPath, absPath);
    return { filename: safeName, absPath, sizeBytes: bytes };
  } catch (err) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      /* best-effort cleanup */
    }
    throw err;
  }
}

/**
 * Delete a single file from the library. Returns true if a file was
 * removed, false if it didn't exist or the name failed validation.
 */
export function deleteLibraryFile(kind: LibraryKind, rawName: string): boolean {
  const safeName = sanitizeUploadFilename(rawName, kind);
  if (!safeName) return false;
  const absPath = path.join(libraryDirFor(kind), safeName);
  if (!fs.existsSync(absPath)) return false;
  fs.unlinkSync(absPath);
  return true;
}
