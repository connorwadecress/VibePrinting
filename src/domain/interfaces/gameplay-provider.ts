import type { GameplayClip } from "../models.js";

export interface GameplaySearchContext {
  /** How many seconds of footage the run needs (typically narration duration + buffer). */
  targetDurationSeconds: number;
  /** Run-scratch dir for any download caches or intermediate files. */
  outputDir: string;
}

/**
 * Source of long-form background gameplay footage (Subway Surfers, Minecraft parkour, etc.).
 * Implementations decide whether the source is a brand-local library, a remote URL, or both.
 *
 * The returned GameplayClip describes a slice (sourcePath + startSeconds + durationSeconds);
 * the actual ffmpeg slicing happens later in the assembler.
 */
export interface GameplayProvider {
  findClip(ctx: GameplaySearchContext): Promise<GameplayClip>;
}
