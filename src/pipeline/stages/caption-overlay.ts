import path from "node:path";
import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState } from "../../domain/models.js";
import { log, logTiming } from "../../utils/logger.js";
import { renderCaptionOverlay } from "../../remotion/render.js";

export class CaptionOverlayStage implements PipelineStage {
  readonly name = "caption-overlay";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    const { rawVideoPath, voiceover } = state;
    if (!rawVideoPath) throw new Error("No raw video path in pipeline state");
    if (!voiceover) throw new Error("No voiceover in pipeline state");

    const start = Date.now();

    if (!voiceover.wordTimings || voiceover.wordTimings.length === 0) {
      log(this.name, "No word-level timing available — skipping animated captions");
      state.outputVideoPath = rawVideoPath;
      return;
    }

    log(this.name, `Overlaying animated captions (${voiceover.wordTimings.length} words)...`);

    const durationSeconds = await context.assembler.getAudioDuration(rawVideoPath);
    const outputPath = path.join(context.workDir, "final.mp4");

    await renderCaptionOverlay({
      videoPath: rawVideoPath,
      wordTimings: voiceover.wordTimings,
      durationSeconds,
      videoSpec: context.videoSpec,
      outputPath,
      captionConfig: context.profile.captionStyle,
    });

    state.outputVideoPath = outputPath;
    logTiming(this.name, start);
  }
}
