import type { SubtitleEntry } from "../models.js";

export interface RedditStoryAssemblyInput {
  /** Source gameplay clip on disk. */
  gameplayPath: string;
  /** Slice start within the source. */
  sliceStartSeconds: number;
  /** Slice duration. */
  sliceDurationSeconds: number;
  /** Stitched per-segment voiceover (already concatenated). */
  voiceoverPath: string;
  /** Optional music track. Looped if shorter than the slice. */
  musicPath?: string;
  outputPath: string;
  /** Music ducking: target music level (dB). Default -22. */
  musicVolumeDb?: number;
  /** Sidechain compress threshold (dB). Default -20. */
  duckThresholdDb?: number;
}

/**
 * Abstract video assembler — prepare clips, concatenate, and produce final video.
 * Implementations: FFmpeg, cloud-based renderers, etc.
 *
 * `concatenateAudio` and `assembleRedditStory` are optional: only the reddit-story
 * pipeline calls them, and they are only implemented by FfmpegAssembler today.
 */
export interface VideoAssembler {
  getAudioDuration(filePath: string): Promise<number>;
  prepareClip(inputPath: string, outputPath: string, targetDuration: number): Promise<void>;
  concatenate(clipPaths: string[], outputPath: string): Promise<void>;
  assemble(
    videoPath: string,
    audioPath: string,
    subtitles: SubtitleEntry[],
    outputPath: string,
  ): Promise<void>;
  /** Concatenate audio files (mp3/wav/etc) into a single track via the concat demuxer. */
  concatenateAudio?(paths: string[], outputPath: string): Promise<void>;
  /** Compose gameplay + voiceover (+ optional music with ducking) into a single video. */
  assembleRedditStory?(input: RedditStoryAssemblyInput): Promise<void>;
}
