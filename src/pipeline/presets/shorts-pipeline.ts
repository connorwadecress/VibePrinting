import type { PipelineStage } from "../../domain/interfaces/pipeline-stage.js";
import { TopicDiscoveryStage } from "../stages/topic-discovery.js";
import { ResearchPackStage } from "../stages/research-pack.js";
import { ScriptGenerationStage } from "../stages/script-generation.js";
import { ScenePlanStage } from "../stages/scene-plan.js";
import { ScriptApprovalGateStage } from "../stages/script-approval-gate.js";
import { StoryboardGenerationStage } from "../stages/storyboard-generation.js";
import { StoryboardApprovalGateStage } from "../stages/storyboard-approval-gate.js";
import { VoiceoverStage } from "../stages/voiceover.js";
import { StockFootageStage } from "../stages/stock-footage.js";
import { AssemblyStage } from "../stages/assembly.js";
import { CaptionOverlayStage } from "../stages/caption-overlay.js";
import { FinalApprovalGateStage } from "../stages/final-approval-gate.js";
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
    new ScriptApprovalGateStage(),
  ];

  if (!options.dryRun) {
    stages.push(
      new ScenePlanStage(),
      new StoryboardGenerationStage(),
      new StoryboardApprovalGateStage(),
      new VoiceoverStage(),
      new StockFootageStage(),
      new AssemblyStage(),
      new CaptionOverlayStage(),
      // Final review gate is always-on, regardless of upload intent. The
      // operator should always preview the rendered video before either
      // publishing OR archiving — without it, a finished video silently
      // drops into the run dir with nobody noticing.
      new FinalApprovalGateStage(),
    );

    if (options.upload) {
      stages.push(new UploadStage());
    }
  }

  return stages;
}
