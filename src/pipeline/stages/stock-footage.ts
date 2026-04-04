import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState, StockClip } from "../../domain/models.js";
import { log } from "../../utils/logger.js";
import path from "node:path";

export class StockFootageStage implements PipelineStage {
  readonly name = "stock-footage";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    const scenes = state.scenes;
    if (!scenes) throw new Error("No scenes in pipeline state");

    log(this.name, `Fetching clips for ${scenes.length} scenes...`);
    const clipsDir = path.join(context.workDir, "clips");
    const clips: StockClip[] = [];

    for (const scene of scenes) {
      const clip = await context.footage.findAndDownloadClip(
        scene.searchKeywords,
        scene.seconds,
        clipsDir,
        scene.sceneIndex,
      );
      clips.push(clip);
    }

    log(this.name, `Downloaded ${clips.length} clips`);
    state.clips = clips;
  }
}
