import type { StockClip } from "../models.js";
import type { LlmClient } from "./llm-client.js";

export interface FootageSearchContext {
  keywords: string[];
  targetDuration: number;
  outputDir: string;
  sceneIndex: number;
  /** Plain-English description of what the ideal clip looks like */
  visualDescription?: string;
  /** The narration being spoken during this scene */
  narration?: string;
  /** If provided, the provider may use the LLM to re-rank top candidates */
  llmClient?: LlmClient;
}

/**
 * Abstract stock footage provider — search and download video clips.
 * Implementations: Pexels, Pixabay, Storyblocks, AI-generated, etc.
 */
export interface FootageProvider {
  findAndDownloadClip(context: FootageSearchContext): Promise<StockClip>;
}
