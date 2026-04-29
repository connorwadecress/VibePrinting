import path from "node:path";
import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState, WordTiming } from "../../domain/models.js";
import { log, logTiming } from "../../utils/logger.js";
import { renderRedditCards } from "../../remotion/render-reddit-cards.js";

export class RedditCaptionOverlayStage implements PipelineStage {
  readonly name = "reddit-caption-overlay";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    const rawVideoPath = state.rawVideoPath;
    const script = state.redditScript;
    if (!rawVideoPath) throw new Error("No raw video path in pipeline state");
    if (!script) throw new Error("No redditScript in pipeline state");

    const start = Date.now();
    const outputPath = path.join(context.workDir, "final.mp4");
    const durationSeconds = await context.assembler.getAudioDuration(rawVideoPath);

    // Flatten per-segment word timings into a single global stream for the
    // word-pop subtitle band (reuses the same Remotion captions component).
    const allWordTimings: WordTiming[] = script.segments.flatMap((s) => s.wordTimings ?? []);

    log(
      this.name,
      `Rendering reddit cards over ${durationSeconds.toFixed(1)}s with ${allWordTimings.length} word timings`,
    );

    await renderRedditCards({
      videoPath: rawVideoPath,
      durationSeconds,
      videoSpec: context.videoSpec,
      outputPath,
      segments: script.segments,
      subreddit: script.post.subreddit,
      wordTimings: allWordTimings,
      captionConfig: context.profile.captionStyle,
      laneConfig: state.lane?.redditConfig,
    });

    state.outputVideoPath = outputPath;
    logTiming(this.name, start);
  }
}
