import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState, StockClip } from "../../domain/models.js";
import { log } from "../../utils/logger.js";
import { writeClips } from "../../utils/run-resume.js";
import path from "node:path";

export class StockFootageStage implements PipelineStage {
  readonly name = "stock-footage";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    const scenes = state.scenes;
    if (!scenes) throw new Error("No scenes in pipeline state");

    if (state.clips && state.clips.length === scenes.length) {
      log(this.name, `Resume: reusing ${state.clips.length} clips`);
      return;
    }

    log(this.name, `Fetching clips for ${scenes.length} scenes...`);
    const clipsDir = path.join(context.workDir, "clips");
    const clips: StockClip[] = [];
    const enableReranking = context.config.llmReranking ?? false;

    if (enableReranking) {
      log(this.name, "LLM re-ranking enabled");
    }

    for (const scene of scenes) {
      // Find the narration for this scene from the script beats
      const narration =
        state.script?.beats.find((b) => b.beatIndex === scene.sceneIndex)?.narration
        ?? state.script?.hook
        ?? "";

      const clip = await context.footage.findAndDownloadClip({
        keywords: scene.searchKeywords,
        targetDuration: scene.seconds,
        outputDir: clipsDir,
        sceneIndex: scene.sceneIndex,
        visualDescription: scene.visualDescription,
        narration,
        llmClient: enableReranking ? context.llm : undefined,
      });
      clips.push(clip);
    }

    log(this.name, `Downloaded ${clips.length} clips`);
    state.clips = clips;
    writeClips(context.workDir, clips);
  }
}
