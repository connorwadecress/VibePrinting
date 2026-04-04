import type { ScenePlanWithKeywords, StockClip } from "../../domain/models.js";
import { findAndDownloadClip } from "../../providers/pexels.js";
import { log } from "../../utils/logger.js";
import path from "node:path";

export async function fetchStockFootage(
  scenes: ScenePlanWithKeywords[],
  workDir: string,
  pexelsApiKey: string,
): Promise<StockClip[]> {
  log("stock-footage", `Fetching clips for ${scenes.length} scenes...`);
  const clipsDir = path.join(workDir, "clips");
  const clips: StockClip[] = [];
  const usedIds = new Set<number>();

  for (const scene of scenes) {
    const clip = await findAndDownloadClip(
      pexelsApiKey,
      scene.searchKeywords,
      scene.seconds,
      clipsDir,
      scene.sceneIndex,
      usedIds,
    );
    clips.push(clip);
  }

  log("stock-footage", `Downloaded ${clips.length} clips`);
  return clips;
}
