import fs from "node:fs";
import path from "node:path";
import ffmpeg from "fluent-ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import type {
  MusicProvider,
  MusicSearchContext,
} from "../../domain/interfaces/music-provider.js";
import type { MusicTrack } from "../../domain/models.js";
import { log } from "../../utils/logger.js";

const ALLOWED_EXTS = new Set([".mp3", ".m4a", ".wav", ".aac", ".ogg"]);

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
 * Picks a music track from a brand-local library. Tracks shorter than the target
 * duration are still returned — the assembler loops them with `-stream_loop -1`.
 *
 * If the directory is missing or empty, `pickTrack()` throws. The reddit-story
 * pipeline's MusicSelectionStage catches this and continues with no music.
 */
export class LibraryMusicProvider implements MusicProvider {
  constructor(private readonly libraryDir: string) {}

  async pickTrack(_ctx: MusicSearchContext): Promise<MusicTrack> {
    if (!fs.existsSync(this.libraryDir)) {
      throw new Error(`Music library not found: ${this.libraryDir}`);
    }
    const candidates = fs
      .readdirSync(this.libraryDir)
      .filter((name) => ALLOWED_EXTS.has(path.extname(name).toLowerCase()))
      .map((name) => path.join(this.libraryDir, name));

    if (candidates.length === 0) {
      throw new Error(`Music library is empty: ${this.libraryDir}`);
    }

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    let duration = 0;
    try {
      duration = await probeDuration(pick);
    } catch (err) {
      log("music", `Could not probe ${path.basename(pick)}: ${(err as Error).message}`);
    }

    log("music", `Using ${path.basename(pick)} (${duration.toFixed(1)}s)`);
    return {
      path: pick,
      durationSeconds: duration,
      title: path.basename(pick, path.extname(pick)),
    };
  }
}
