import type { FootageProvider, FootageSearchContext } from "../../domain/interfaces/footage-provider.js";
import type { StockClip } from "../../domain/models.js";
import { log } from "../../utils/logger.js";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class MockFootageProvider implements FootageProvider {
  async findAndDownloadClip(context: FootageSearchContext): Promise<StockClip> {
    const { outputDir, sceneIndex, targetDuration, keywords } = context;
    const localPath = path.join(outputDir, `scene-${sceneIndex}-raw.mp4`);
    const seconds = Math.max(1, Math.ceil(targetDuration));

    log("mock-footage", `Generating synthetic clip for scene ${sceneIndex} (${seconds}s)`);

    await execFileAsync("ffmpeg", [
      "-y",
      "-f", "lavfi",
      "-i", `color=c=#1a1a1a:s=1080x1920:d=${seconds}`,
      "-vf", `drawtext=text='Mock Scene ${sceneIndex}':fontcolor=white:fontsize=72:x=(w-text_w)/2:y=(h-text_h)/2`,
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      localPath,
    ]);

    return {
      id: sceneIndex,
      url: `mock://scene-${sceneIndex}`,
      width: 1080,
      height: 1920,
      duration: seconds,
      localPath,
      searchQuery: keywords[0] ?? `mock-scene-${sceneIndex}`,
    };
  }
}
