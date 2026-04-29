import fs from "node:fs";
import path from "node:path";
import ffmpeg from "fluent-ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import type {
  GameplayProvider,
  GameplaySearchContext,
} from "../../domain/interfaces/gameplay-provider.js";
import type { AssetEntry } from "../../domain/channel-profile.js";
import type { GameplayClip } from "../../domain/models.js";
import { log } from "../../utils/logger.js";

const ALLOWED_EXTS = new Set([".mp4", ".mov", ".mkv", ".webm"]);

ffmpeg.setFfprobePath(ffprobeInstaller.path);

function probeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format?.duration ?? 0);
    });
  });
}

/**
 * Picks a long-form gameplay clip from a brand-local library directory.
 * Throws when the directory is missing/empty or no file is long enough.
 *
 * If `entries` is provided and non-empty, only filenames present and
 * marked enabled are eligible. Otherwise every file in the directory
 * with an allowed extension is eligible.
 */
export class LibraryGameplayProvider implements GameplayProvider {
  constructor(
    private readonly libraryDir: string,
    private readonly entries?: AssetEntry[],
  ) {}

  async findClip(ctx: GameplaySearchContext): Promise<GameplayClip> {
    if (!fs.existsSync(this.libraryDir)) {
      throw new Error(
        `Gameplay library not found: ${this.libraryDir}. ` +
          `Drop one or more .mp4/.mov files into this directory.`,
      );
    }

    const onDisk = fs
      .readdirSync(this.libraryDir)
      .filter((name) => ALLOWED_EXTS.has(path.extname(name).toLowerCase()));

    const eligible = filterByEntries(onDisk, this.entries);
    const candidates = eligible.map((name) => path.join(this.libraryDir, name));

    if (candidates.length === 0) {
      throw new Error(
        this.entries && this.entries.length > 0
          ? `No enabled gameplay clips on disk in ${this.libraryDir}. ` +
              `Toggle some on in the brand editor's asset library.`
          : `Gameplay library is empty: ${this.libraryDir}. ` +
              `Drop one or more .mp4/.mov files into this directory.`,
      );
    }

    // Probe durations and keep only those long enough.
    const usable: { path: string; duration: number }[] = [];
    for (const p of candidates) {
      try {
        const d = await probeDuration(p);
        if (d >= ctx.targetDurationSeconds) usable.push({ path: p, duration: d });
      } catch (err) {
        log("gameplay", `Skipping ${path.basename(p)}: ${(err as Error).message}`);
      }
    }

    if (usable.length === 0) {
      throw new Error(
        `No gameplay clip in ${this.libraryDir} is long enough ` +
          `(need ≥ ${ctx.targetDurationSeconds.toFixed(1)}s).`,
      );
    }

    const pick = usable[Math.floor(Math.random() * usable.length)];
    const maxStart = Math.max(0, pick.duration - ctx.targetDurationSeconds);
    const startSeconds = Math.random() * maxStart;

    log(
      "gameplay",
      `Using ${path.basename(pick.path)} ` +
        `(slice ${startSeconds.toFixed(1)}-${(startSeconds + ctx.targetDurationSeconds).toFixed(1)}s of ${pick.duration.toFixed(1)}s)`,
    );

    return {
      sourcePath: pick.path,
      startSeconds,
      durationSeconds: ctx.targetDurationSeconds,
    };
  }
}

/**
 * Apply a brand's per-file enable/order list to a flat list of filenames
 * found on disk. Files not present in `entries` are skipped (so a brand
 * can opt out of a clip by removing its entry; new files only become
 * eligible after they're added in the editor).
 */
function filterByEntries(onDisk: string[], entries?: AssetEntry[]): string[] {
  if (!entries || entries.length === 0) return onDisk;
  const diskSet = new Set(onDisk);
  return entries
    .filter((e) => e.enabled !== false && diskSet.has(e.filename))
    .map((e) => e.filename);
}
