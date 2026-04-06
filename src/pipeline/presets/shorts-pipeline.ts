import type { PipelineStage } from "../../domain/interfaces/pipeline-stage.js";
import { TopicDiscoveryStage } from "../stages/topic-discovery.js";
import { ResearchPackStage } from "../stages/research-pack.js";
import { ScriptGenerationStage } from "../stages/script-generation.js";
import { ScenePlanStage } from "../stages/scene-plan.js";
import { VoiceoverStage } from "../stages/voiceover.js";
import { StockFootageStage } from "../stages/stock-footage.js";
import { AssemblyStage } from "../stages/assembly.js";
import { CaptionOverlayStage } from "../stages/caption-overlay.js";
import { UploadStage } from "../stages/upload.js";

export interface ShortsPipelineOptions {
  dryRun?: boolean;
  upload?: boolean;
}

/**
 * Builds the standard YouTube Shorts / TikTok pipeline.
 * Stages are returned in execution order.
 */
export function buildShortsPipeline(options: ShortsPipelineOptions = {}): PipelineStage[] {
  const stages: PipelineStage[] = [
    new TopicDiscoveryStage(),
    new ResearchPackStage(),
    new ScriptGenerationStage(),
  ];

  if (!options.dryRun) {
    stages.push(
      new ScenePlanStage(),
      new VoiceoverStage(),
      new StockFootageStage(),
      new AssemblyStage(),
      new CaptionOverlayStage(),
    );

    if (options.upload) {
      stages.push(new UploadStage());
    }
  }

  return stages;
}
