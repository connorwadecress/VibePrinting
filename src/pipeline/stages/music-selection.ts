import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState } from "../../domain/models.js";
import { log } from "../../utils/logger.js";

export class MusicSelectionStage implements PipelineStage {
  readonly name = "music-selection";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    if (!context.music) {
      log(this.name, "No music provider configured — skipping music");
      return;
    }
    const script = state.redditScript;
    if (!script) throw new Error("No redditScript in pipeline state");

    try {
      const track = await context.music.pickTrack({
        targetDurationSeconds: script.totalDurationEstimateSeconds,
      });
      state.musicTrack = track;
    } catch (err) {
      log(this.name, `Music selection failed (${(err as Error).message}); proceeding without music`);
    }
  }
}
