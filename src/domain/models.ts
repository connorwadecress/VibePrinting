export type ContentLaneId =
  | "history-flash"
  | "human-limits"
  | "everyday-systems";

export type RiskLevel = "low" | "medium" | "high";

export type PipelineStageName =
  | "topic-discovery"
  | "research-pack"
  | "script-generation"
  | "voiceover"
  | "scene-plan"
  | "video-render"
  | "assembly"
  | "gensec-review"
  | "publish";

export interface ContentLane {
  description: string;
  exampleHooks: string[];
  id: ContentLaneId;
  targetDurationSeconds: number;
}

export interface ChannelTheme {
  contentLanes: ContentLane[];
  description: string;
  id: string;
  publishSlots: string[];
  thesis: string;
}

export interface TopicCandidate {
  laneId: ContentLaneId;
  noveltyScore: number;
  riskLevel: RiskLevel;
  seedQuestion: string;
  titleAngle: string;
}

export interface ResearchClaim {
  claim: string;
  confidence: "tentative" | "supported" | "strong";
  sourceLabels: string[];
}

export interface ResearchPack {
  claims: ResearchClaim[];
  summary: string;
  topic: string;
}

export interface ScriptBeat {
  beatIndex: number;
  narration: string;
  visualIntent: string;
}

export interface ShortScript {
  callToAction: string;
  hook: string;
  payoff: string;
  beats: ScriptBeat[];
  totalDurationSeconds: number;
}

export interface ScenePlan {
  captions: string[];
  prompt: string;
  sceneIndex: number;
  seconds: number;
}

export interface GenSecAssessment {
  blockedReasons: string[];
  disclosureRequired: boolean;
  riskLevel: RiskLevel;
  safeToAutoPublish: boolean;
}

export interface PublishPackage {
  description: string;
  disclosureRequired: boolean;
  scheduledSlot: string;
  tags: string[];
  title: string;
}

export interface PipelineStageBlueprint {
  name: PipelineStageName;
  output: string;
  purpose: string;
}

