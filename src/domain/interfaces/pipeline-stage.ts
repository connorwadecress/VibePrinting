import type { AppConfig } from "../../config.js";
import type { ChannelProfile } from "../channel-profile.js";
import type { VideoSpec } from "../video-specs.js";
import type { PipelineState, TopicHistoryEntry } from "../models.js";
import type { LlmClient } from "./llm-client.js";
import type { TtsProvider } from "./tts-provider.js";
import type { FootageProvider } from "./footage-provider.js";
import type { VideoAssembler } from "./video-assembler.js";
import type { Uploader } from "./uploader.js";

/**
 * Everything a pipeline stage needs to do its work.
 * Stages pull providers from here instead of importing concrete implementations.
 */
export interface StageContext {
  llm: LlmClient;
  tts: TtsProvider;
  footage: FootageProvider;
  assembler: VideoAssembler;
  uploaders: Uploader[];
  profile: ChannelProfile;
  videoSpec: VideoSpec;
  config: AppConfig;
  workDir: string;
  runId: string;
  topicHistory?: TopicHistoryEntry[];
}

/**
 * A single pipeline stage.
 * Reads input from `state`, writes output back to `state`, gets providers from `context`.
 */
export interface PipelineStage {
  readonly name: string;
  execute(state: PipelineState, context: StageContext): Promise<void>;
}
