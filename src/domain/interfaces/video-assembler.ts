import type { SubtitleEntry } from "../models.js";

/**
 * Abstract video assembler — prepare clips, concatenate, and produce final video.
 * Implementations: FFmpeg, cloud-based renderers, etc.
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
}
