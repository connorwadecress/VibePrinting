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
 * How a comment voice is picked from `commentVoicePool`:
 * - `random`: fresh random pick each comment.
 * - `by-author`: deterministic hash of the commenter's username, so the
 *   same author always gets the same voice within a video. Best for
 *   coherence in AskReddit-style threads.
 * - `round-robin`: cycles through the pool in order.
 */
export type CommentVoiceMode = "random" | "by-author" | "round-robin";

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
 * One file in a brand-wide asset library (gameplay clips or music tracks).
 * The actual file lives on disk under `gameplayLibraryDir` / `musicLibraryDir`;
 * this entry just records the filename and whether it should be eligible
 * for selection. Order in the array is the display/priority order.
 */
export interface AssetEntry {
  filename: string;
  enabled?: boolean;
}

/**
 * A complete channel identity — loaded from a user-created JSON file.
 * This is never hardcoded in source. Users create their own `channel.json`
 * from `channel.example.json` to define their brand.
 *
 * `ttsProvider`, `ttsProviderSettings`, and `cleanup` are optional for
 * backward compatibility; existing profiles continue to work unchanged.
 *
 * The `gameplayLibraryDir`, `musicLibraryDir`, and `ytDlpFallbackUrls`
 * fields are consumed only by reddit-story lanes. When omitted, the
 * pipeline reads from the cross-brand shared library at
 * `<repo>/shared/{gameplay,music}` (overridable via VP_SHARED_DIR).
 * Set these fields explicitly only if a brand needs a private pool.
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
  /** Absolute or brand-relative path to a directory of gameplay .mp4/.mov files. */
  gameplayLibraryDir?: string;
  /** Absolute or brand-relative path to a directory of music .mp3/.m4a/.wav files. */
  musicLibraryDir?: string;
  /** Optional yt-dlp fallback URLs used when the gameplay library is empty/short. */
  ytDlpFallbackUrls?: string[];
  /** Per-file enable/order for gameplay clips. When present, only enabled entries are eligible. */
  gameplayLibrary?: AssetEntry[];
  /** Per-file enable/order for music tracks. When present, only enabled entries are eligible. */
  musicLibrary?: AssetEntry[];
  /**
   * Voices to rotate through for `comment` segments in reddit-story lanes.
   * Format must match the active TTS provider:
   *   - elevenlabs: voice IDs (e.g. "8IbUB2LiiCZ85IJAHNnZ")
   *   - edge: voice names (e.g. "en-US-AriaNeural")
   * Narrator segments (intro/question/description/outro) keep using the
   * configured default voice — only `comment` segments rotate. When empty
   * or omitted, all segments use the default voice (legacy behavior).
   */
  commentVoicePool?: string[];
  /** How to pick a voice from `commentVoicePool`. Default: "by-author". */
  commentVoiceMode?: CommentVoiceMode;
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
