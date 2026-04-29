import path from "node:path";
import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState } from "../../domain/models.js";
import { log, logTiming } from "../../utils/logger.js";

export class RedditAssemblyStage implements PipelineStage {
  readonly name = "reddit-assembly";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    const script = state.redditScript;
    const gameplayClip = state.gameplayClip;
    const voiceoverPath = state.redditVoiceoverPath;
    if (!script) throw new Error("No redditScript in pipeline state");
    if (!gameplayClip) throw new Error("No gameplayClip in pipeline state");
    if (!voiceoverPath) throw new Error("No redditVoiceoverPath in pipeline state");
    if (!context.assembler.assembleRedditStory) {
      throw new Error(
        "Configured VideoAssembler does not implement assembleRedditStory (required by reddit-story)",
      );
    }

    const start = Date.now();
    const outputPath = path.join(context.workDir, "assembled.mp4");
    // Cut the video right when the speaking ends — voiceover length + a small
    // tail so the final word's audio fades cleanly. Capped at:
    //   - the gameplay clip's available duration (never request more footage), and
    //   - the lane's targetDurationSeconds + tail (Shorts must stay under cap;
    //     better to truncate audio than to ship as a long-form video).
    const voiceoverSeconds = await context.assembler.getAudioDuration(voiceoverPath);
    const TAIL_SECONDS = 0.3;
    const target = state.lane?.targetDurationSeconds;
    const naturalEnd = voiceoverSeconds + TAIL_SECONDS;
    const hardCap = target ? target + TAIL_SECONDS : Infinity;
    const sliceDuration = Math.min(naturalEnd, hardCap, gameplayClip.durationSeconds);
    if (target && naturalEnd > hardCap) {
      log(
        this.name,
        `Truncating: voiceover ${voiceoverSeconds.toFixed(1)}s + tail exceeds target ${target}s — cutting at ${sliceDuration.toFixed(1)}s`,
      );
    }

    await context.assembler.assembleRedditStory!({
      gameplayPath: gameplayClip.sourcePath,
      sliceStartSeconds: gameplayClip.startSeconds,
      sliceDurationSeconds: sliceDuration,
      voiceoverPath,
      musicPath: state.musicTrack?.path,
      outputPath,
    });

    state.rawVideoPath = outputPath;
    log(this.name, `Assembled video -> ${outputPath}`);
    logTiming(this.name, start);
  }
}
