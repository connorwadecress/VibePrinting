import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState } from "../../domain/models.js";
import { log } from "../../utils/logger.js";
import { ensureGlobalAssetManifest, writeStoryboardArtifacts } from "../../utils/storyboard.js";

export class StoryboardGenerationStage implements PipelineStage {
  readonly name = "storyboard-generation";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    if (state.storyboard) {
      log(this.name, `Resume: reusing storyboard (${state.storyboard.scenes.length} scenes)`);
      state.assetManifest ??= ensureGlobalAssetManifest(context.workDir);
      return;
    }

    if (!state.script) throw new Error("No script in pipeline state");
    if (!state.scenes || state.scenes.length === 0) throw new Error("No scenes in pipeline state");

    log(this.name, "Generating storyboard artifacts...");
    state.assetManifest = ensureGlobalAssetManifest(context.workDir);
    const deck = await writeStoryboardArtifacts(
      context.workDir,
      context.runId,
      context.profile,
      state,
    );
    log(this.name, `Storyboard deck created with ${deck.scenes.length} scenes`);
  }
}
