import { createClient, type Videos, type ErrorResponse, type Video } from "pexels";
import type { StockClip } from "../domain/models.js";
import { downloadFile } from "../utils/fs-helpers.js";
import { log } from "../utils/logger.js";
import path from "node:path";

function isError(res: Videos | ErrorResponse): res is ErrorResponse {
  return "error" in res;
}

export async function searchVideos(
  apiKey: string,
  query: string,
  minDuration: number = 3,
  perPage: number = 5,
): Promise<Video[]> {
  const client = createClient(apiKey);
  const res = await client.videos.search({
    query,
    per_page: perPage,
    min_duration: minDuration,
  });
  if (isError(res)) throw new Error(`Pexels search failed: ${res.error}`);
  return res.videos;
}

export async function findAndDownloadClip(
  apiKey: string,
  keywords: string[],
  minDuration: number,
  outputDir: string,
  sceneIndex: number,
  usedIds: Set<number>,
): Promise<StockClip> {
  // Try keywords from most specific to least specific
  for (const keyword of keywords) {
    log("pexels", `Searching: "${keyword}"`);
    const videos = await searchVideos(apiKey, keyword, Math.max(minDuration, 3), 15);

    // Filter out already-used clips, pick a random one from remaining
    const unused = videos.filter((v) => !usedIds.has(v.id));
    const pool = unused.length > 0 ? unused : videos;

    if (pool.length > 0) {
      const video = pool[Math.floor(Math.random() * pool.length)];
      usedIds.add(video.id);

      // Prefer HD portrait/square, fall back to any HD
      const file =
        video.video_files.find(
          (f) => f.quality === "hd" && f.height && f.width && f.height >= f.width,
        ) ??
        video.video_files.find((f) => f.quality === "hd") ??
        video.video_files.find((f) => f.quality === "sd") ??
        video.video_files[0];

      const ext = ".mp4";
      const localPath = path.join(outputDir, `scene-${sceneIndex}-raw${ext}`);
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
