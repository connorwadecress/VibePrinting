import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState } from "../../domain/models.js";
import { log } from "../../utils/logger.js";

const BUFFER_SECONDS = 5;

export class GameplayFootageStage implements PipelineStage {
  readonly name = "gameplay-footage";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    if (!context.gameplay) {
      throw new Error(
        "GameplayProvider is not configured. Reddit-story lanes need a gameplay provider " +
          "wired in StageContext (set gameplayLibraryDir on the channel profile, or add ytDlpFallbackUrls).",
      );
    }
    const script = state.redditScript;
    if (!script) throw new Error("No redditScript in pipeline state");

    const target = script.totalDurationEstimateSeconds + BUFFER_SECONDS;
    log(this.name, `Need ${target.toFixed(1)}s of gameplay`);

    const clip = await context.gameplay.findClip({
      targetDurationSeconds: target,
      outputDir: context.workDir,
    });
    state.gameplayClip = clip;
  }
}
