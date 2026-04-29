import type { PipelineStage } from "../../domain/interfaces/pipeline-stage.js";
import { RedditSourceStage } from "../stages/reddit-source.js";
import { CommentSelectionStage } from "../stages/comment-selection.js";
import { RedditScriptStage } from "../stages/reddit-script.js";
import { GameplayFootageStage } from "../stages/gameplay-footage.js";
import { MusicSelectionStage } from "../stages/music-selection.js";
import { RedditVoiceoverStage } from "../stages/reddit-voiceover.js";
import { RedditAssemblyStage } from "../stages/reddit-assembly.js";
import { RedditCaptionOverlayStage } from "../stages/reddit-caption-overlay.js";
import { UploadStage } from "../stages/upload.js";

export interface RedditStoryPipelineOptions {
  dryRun?: boolean;
  upload?: boolean;
}

/**
 * Reddit story pipeline:
 *   reddit-source -> comment-selection -> reddit-script
 *   (then, when not dry-run)
 *   gameplay-footage -> music-selection -> reddit-voiceover -> reddit-assembly -> reddit-caption-overlay
 *   (then, when uploading)
 *   upload
 */
export function buildRedditStoryPipeline(
  options: RedditStoryPipelineOptions = {},
): PipelineStage[] {
  const stages: PipelineStage[] = [
    new RedditSourceStage(),
    new CommentSelectionStage(),
    new RedditScriptStage(),
  ];

  if (!options.dryRun) {
    stages.push(
      new GameplayFootageStage(),
      new MusicSelectionStage(),
      new RedditVoiceoverStage(),
      new RedditAssemblyStage(),
      new RedditCaptionOverlayStage(),
    );

    if (options.upload) {
      stages.push(new UploadStage());
    }
  }

  return stages;
}
