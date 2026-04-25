import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState } from "../../domain/models.js";
import { log, logTiming } from "../../utils/logger.js";
import fs from "node:fs";
import path from "node:path";

export class AssemblyStage implements PipelineStage {
  readonly name = "assembly";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    if (state.rawVideoPath && fs.existsSync(state.rawVideoPath)) {
      log(this.name, `Resume: reusing assembled video at ${state.rawVideoPath}`);
      return;
    }

    const { scenes, clips, voiceover, script } = state;
    if (!scenes) throw new Error("No scenes in pipeline state");
    if (!clips) throw new Error("No clips in pipeline state");
    if (!voiceover) throw new Error("No voiceover in pipeline state");
    if (!script) throw new Error("No script in pipeline state");

    const start = Date.now();
    log(this.name, "Starting video assembly...");

    const assembler = context.assembler;

    // Probe real audio duration — TTS library's getDuration() is unreliable
    const realAudioDuration = await assembler.getAudioDuration(voiceover.audioPath);
    const plannedDuration = scenes.reduce((sum, s) => sum + s.seconds, 0);
    const scaleFactor = realAudioDuration / plannedDuration;

    if (Math.abs(scaleFactor - 1) > 0.05) {
      log(this.name, `Scaling scene durations by ${scaleFactor.toFixed(2)}x to match audio (${realAudioDuration.toFixed(1)}s)`);
    }

    // Step 1: Prepare each clip — durations scaled to match real audio length
    const preparedPaths: string[] = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const clip = clips[i];
      if (!clip.localPath) throw new Error(`No local path for scene ${i}`);

      const scaledDuration = Math.max(1, scene.seconds * scaleFactor);
      const preparedPath = path.join(context.workDir, "clips", `scene-${scene.sceneIndex}-prep.mp4`);
      await assembler.prepareClip(clip.localPath, preparedPath, scaledDuration);
      preparedPaths.push(preparedPath);
    }

    // Step 2: Concatenate all prepared clips
    const concatPath = path.join(context.workDir, "concat.mp4");
    await assembler.concatenate(preparedPaths, concatPath);
    log(this.name, "Clips concatenated");

    // Step 3: Assemble with voiceover (captions added by CaptionOverlayStage)
    const outputPath = path.join(context.workDir, "assembled.mp4");
    await assembler.assemble(concatPath, voiceover.audioPath, [], outputPath);

    logTiming(this.name, start);
    state.rawVideoPath = outputPath;
  }
}
