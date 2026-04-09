import type { ContentLane, GenSecAssessment } from "./models.js";
import type { AnimatedCaptionConfig } from "../remotion/styles.js";
import fs from "node:fs";
import path from "node:path";

export interface ChannelBranding {
  tags: string[];
  hashtags: string[];
  youTubeCategory: string;
}

/**
 * Which TTS provider a brand prefers. If omitted, the pipeline falls back
 * to the global TTS_PROVIDER env var (AppConfig.ttsProvider).
 */
export type TtsProviderKind = "edge" | "elevenlabs";

/**
 * ElevenLabs-specific overrides that live on the channel profile. API keys
 * are never stored here — they remain in `.env` files.
 */
export interface ElevenLabsTtsSettings {
  voiceId?: string;
  modelId?: string;
  speed?: number;
}

/**
 * Provider-specific TTS config. Only the entry matching `ttsProvider` is
 * consumed; others are ignored. Kept separate so switching provider doesn't
 * discard the other provider's settings.
 */
export interface TtsProviderSettings {
  elevenLabs?: ElevenLabsTtsSettings;
}

/**
 * Auto-cleanup policy for a brand. When enabled, the run directory is
 * deleted `delayMinutes` after a successful upload. topic-history.json
 * lives outside the run dir so it is never touched by cleanup.
 */
export interface CleanupConfig {
  enabled: boolean;
  delayMinutes: number;
}

/**
 * A complete channel identity — loaded from a user-created JSON file.
 * This is never hardcoded in source. Users create their own `channel.json`
 * from `channel.example.json` to define their brand.
 *
 * `ttsProvider`, `ttsProviderSettings`, and `cleanup` are optional for
 * backward compatibility; existing profiles continue to work unchanged.
 */
export interface ChannelProfile {
  id: string;
  displayName: string;
  thesis: string;
  contentLanes: ContentLane[];
  publishSlots: string[];
  branding: ChannelBranding;
  ttsVoice: string;
  ttsRate: string;
  genSecDefaults: GenSecAssessment;
  captionStyle?: Partial<AnimatedCaptionConfig>;
  ttsProvider?: TtsProviderKind;
  ttsProviderSettings?: TtsProviderSettings;
  cleanup?: CleanupConfig;
}

/**
 * Loads a ChannelProfile from a JSON file.
 * Default path: `channel.json` in the project root.
 * Override via CHANNEL_PROFILE_PATH env var.
 */
export function loadProfile(filePath?: string): ChannelProfile {
  const resolvedPath = filePath
    ?? process.env.CHANNEL_PROFILE_PATH
    ?? path.resolve("channel.json");

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Channel profile not found: ${resolvedPath}\n` +
      `Use --brand=<id> to select a brand folder, or copy channel.example.json to channel.json.`,
    );
  }

  const raw = fs.readFileSync(resolvedPath, "utf-8");
  const profile = JSON.parse(raw) as ChannelProfile;

  if (!profile.id || !profile.contentLanes?.length) {
    throw new Error(
      `Invalid channel profile: ${resolvedPath}\n` +
      `Must have at least "id" and one entry in "contentLanes".`,
    );
  }

  return profile;
}
