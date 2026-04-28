import type { PipelineStage } from "../../domain/interfaces/pipeline-stage.js";

export interface RedditStoryPipelineOptions {
  dryRun?: boolean;
  upload?: boolean;
}

/**
 * Reddit story pipeline — empty stub. Fill in stages when ready.
 */
export function buildRedditStoryPipeline(_options: RedditStoryPipelineOptions = {}): PipelineStage[] {
  return [];
}
