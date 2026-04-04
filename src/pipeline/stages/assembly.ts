import type {
  ScenePlanWithKeywords,
  StockClip,
  VoiceoverResult,
  ShortScript,
} from "../../domain/models.js";
import { prepareClip, concatenateClips, assembleVideo, getAudioDuration } from "../../providers/ffmpeg.js";
import { log, logTiming } from "../../utils/logger.js";
import path from "node:path";

export async function assembleShort(
  scenes: ScenePlanWithKeywords[],
  clips: StockClip[],
  voiceover: VoiceoverResult,
  script: ShortScript,
  workDir: string,
): Promise<string> {
  const start = Date.now();
  log("assembly", "Starting video assembly...");

  // Probe the real audio duration from the file — the TTS library's getDuration()
  // is unreliable. We use this to scale scene durations so video always matches audio.
  const realAudioDuration = await getAudioDuration(voiceover.audioPath);
  const plannedDuration = scenes.reduce((sum, s) => sum + s.seconds, 0);
  const scaleFactor = realAudioDuration / plannedDuration;

  if (Math.abs(scaleFactor - 1) > 0.05) {
    log("assembly", `Scaling scene durations by ${scaleFactor.toFixed(2)}x to match audio (${realAudioDuration.toFixed(1)}s)`);
  }

  // Step 1: Prepare each clip — durations scaled to match real audio length
  const preparedPaths: string[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const clip = clips[i];
    if (!clip.localPath) throw new Error(`No local path for scene ${i}`);

    const scaledDuration = Math.max(1, scene.seconds * scaleFactor);
    const preparedPath = path.join(workDir, "clips", `scene-${scene.sceneIndex}-prep.mp4`);
    await prepareClip(clip.localPath, preparedPath, scaledDuration);
    preparedPaths.push(preparedPath);
  }

  // Step 2: Concatenate all prepared clips
  const concatPath = path.join(workDir, "concat.mp4");
  await concatenateClips(preparedPaths, concatPath);
  log("assembly", "Clips concatenated");

  // Step 3: Assemble with voiceover + captions
  const outputPath = path.join(workDir, "final.mp4");
  await assembleVideo(
    concatPath,
    voiceover.audioPath,
    voiceover.subtitles,
    outputPath,
  );

  logTiming("assembly", start);
  return outputPath;
}
