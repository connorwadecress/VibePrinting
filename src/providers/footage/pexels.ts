import { createClient, type Videos, type ErrorResponse, type Video } from "pexels";
import type { FootageProvider } from "../../domain/interfaces/footage-provider.js";
import type { StockClip } from "../../domain/models.js";
import { downloadFile } from "../../utils/fs-helpers.js";
import { log } from "../../utils/logger.js";
import path from "node:path";

function isError(res: Videos | ErrorResponse): res is ErrorResponse {
  return "error" in res;
}

export class PexelsProvider implements FootageProvider {
  private readonly usedIds = new Set<number>();

  constructor(private readonly apiKey: string) {}

  async findAndDownloadClip(
    keywords: string[],
    minDuration: number,
    outputDir: string,
    sceneIndex: number,
  ): Promise<StockClip> {
    const client = createClient(this.apiKey);

    for (const keyword of keywords) {
      log("pexels", `Searching: "${keyword}"`);
      const res = await client.videos.search({
        query: keyword,
        per_page: 15,
        min_duration: Math.max(minDuration, 3),
      });
      if (isError(res)) throw new Error(`Pexels search failed: ${res.error}`);

      const unused = res.videos.filter((v) => !this.usedIds.has(v.id));
      const pool = unused.length > 0 ? unused : res.videos;

      if (pool.length > 0) {
        const video = pool[Math.floor(Math.random() * pool.length)];
        this.usedIds.add(video.id);

        const file =
          video.video_files.find(
            (f) => f.quality === "hd" && f.height && f.width && f.height >= f.width,
          ) ??
          video.video_files.find((f) => f.quality === "hd") ??
          video.video_files.find((f) => f.quality === "sd") ??
          video.video_files[0];

        const localPath = path.join(outputDir, `scene-${sceneIndex}-raw.mp4`);
        log("pexels", `Downloading clip ${video.id} (${video.duration}s)...`);
        await downloadFile(file.link, localPath);

        return {
          id: video.id,
          url: file.link,
          width: file.width ?? video.width,
          height: file.height ?? video.height,
          duration: video.duration,
          localPath,
          searchQuery: keyword,
        };
      }
    }

    throw new Error(`No Pexels videos found for keywords: ${keywords.join(", ")}`);
  }
}
