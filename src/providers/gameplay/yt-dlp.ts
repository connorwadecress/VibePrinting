import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpeg from "fluent-ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import type {
  GameplayProvider,
  GameplaySearchContext,
} from "../../domain/interfaces/gameplay-provider.js";
import type { GameplayClip } from "../../domain/models.js";
import { log } from "../../utils/logger.js";

const exec = promisify(execFile);

ffmpeg.setFfprobePath(ffprobeInstaller.path);

function probeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format?.duration ?? 0);
    });
  });
}

function urlToCacheId(url: string): string {
  // crude but stable: hostname + last path segment + length-based hash
  const m = /([^\/?#]+)(?:[?#].*)?$/.exec(url);
  const tail = (m?.[1] ?? "video").replace(/[^a-zA-Z0-9_-]/g, "_");
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) | 0;
  return `${tail}-${(h >>> 0).toString(16)}`;
}

/**
 * Pulls long-form gameplay via the `yt-dlp` binary. Caches downloads in `cacheDir`
 * so subsequent runs hit disk instead of the network.
 *
 * Throws clearly when `yt-dlp` is not on PATH so the failure is obvious to operators.
 */
export class YtDlpGameplayProvider implements GameplayProvider {
  constructor(
    private readonly urls: string[],
    private readonly cacheDir: string,
  ) {}

  async findClip(ctx: GameplaySearchContext): Promise<GameplayClip> {
    if (this.urls.length === 0) {
      throw new Error("YtDlpGameplayProvider has no source URLs configured");
    }
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    const url = this.urls[Math.floor(Math.random() * this.urls.length)];
    const cacheId = urlToCacheId(url);

    // Check cache first
    const cached = fs
      .readdirSync(this.cacheDir)
      .find((name) => name.startsWith(cacheId + "."));
    let videoPath: string | undefined = cached
      ? path.join(this.cacheDir, cached)
      : undefined;

    if (!videoPath) {
      log("gameplay", `yt-dlp fetching: ${url}`);
      try {
        const outTemplate = path.join(this.cacheDir, `${cacheId}.%(ext)s`);
        await exec("yt-dlp", [
          "-f",
          "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
          "--no-playlist",
          "-o",
          outTemplate,
          url,
        ]);
      } catch (err) {
        const msg = (err as Error).message ?? String(err);
        if (/ENOENT|not found|not recognized/i.test(msg)) {
          throw new Error(
            "yt-dlp is not installed. Install via `apt-get install yt-dlp` " +
              "or `pipx install yt-dlp` and ensure it's on PATH.",
          );
        }
        throw new Error(`yt-dlp failed for ${url}: ${msg}`);
      }
      const downloaded = fs
        .readdirSync(this.cacheDir)
        .find((name) => name.startsWith(cacheId + "."));
      if (!downloaded) {
        throw new Error(`yt-dlp completed but no file matched ${cacheId}.* in ${this.cacheDir}`);
      }
      videoPath = path.join(this.cacheDir, downloaded);
    } else {
      log("gameplay", `Using cached gameplay: ${path.basename(videoPath)}`);
    }

    const duration = await probeDuration(videoPath);
    if (duration < ctx.targetDurationSeconds) {
      throw new Error(
        `yt-dlp source too short (${duration.toFixed(1)}s < ${ctx.targetDurationSeconds.toFixed(1)}s): ${videoPath}`,
      );
    }

    const maxStart = Math.max(0, duration - ctx.targetDurationSeconds);
    const startSeconds = Math.random() * maxStart;
    return {
      sourcePath: videoPath,
      startSeconds,
      durationSeconds: ctx.targetDurationSeconds,
    };
  }
}
