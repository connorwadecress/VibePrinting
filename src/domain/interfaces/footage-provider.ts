import type { StockClip } from "../models.js";

/**
 * Abstract stock footage provider — search and download video clips.
 * Implementations: Pexels, Pixabay, Storyblocks, AI-generated, etc.
 */
export interface FootageProvider {
  findAndDownloadClip(
    keywords: string[],
    minDuration: number,
    outputDir: string,
    sceneIndex: number,
  ): Promise<StockClip>;
}
