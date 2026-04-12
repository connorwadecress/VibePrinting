/**
 * Shared constants and types for brand .env management.
 * No Node.js imports — safe to use in both server and client code.
 */

export const BRAND_ENV_WHITELIST = [
  // LLM
  "LLM_PROVIDER",
  "ANTHROPIC_API_KEY",
  "CLAUDE_MODEL",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  // TTS
  "TTS_PROVIDER",
  "TTS_VOICE",
  "TTS_RATE",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID",
  "ELEVENLABS_MODEL_ID",
  // Stock footage
  "PEXELS_API_KEY",
  // YouTube
  "YOUTUBE_CLIENT_ID",
  "YOUTUBE_CLIENT_SECRET",
  "YOUTUBE_REFRESH_TOKEN",
  "YOUTUBE_CHANNEL_ID",
  // TikTok
  "TIKTOK_CLIENT_KEY",
  "TIKTOK_CLIENT_SECRET",
  "TIKTOK_ACCESS_TOKEN",
  "TIKTOK_REFRESH_TOKEN",
] as const;

export type BrandEnvKey = (typeof BRAND_ENV_WHITELIST)[number];
export type BrandEnvMap = Partial<Record<BrandEnvKey, string>>;

export interface EnvGroup {
  label: string;
  keys: BrandEnvKey[];
}

export const BRAND_ENV_GROUPS: EnvGroup[] = [
  {
    label: "LLM",
    keys: ["LLM_PROVIDER", "ANTHROPIC_API_KEY", "CLAUDE_MODEL", "GEMINI_API_KEY", "GEMINI_MODEL"],
  },
  {
    label: "Text-to-speech",
    keys: ["TTS_PROVIDER", "TTS_VOICE", "TTS_RATE", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "ELEVENLABS_MODEL_ID"],
  },
  {
    label: "Stock footage",
    keys: ["PEXELS_API_KEY"],
  },
  {
    label: "YouTube",
    keys: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN", "YOUTUBE_CHANNEL_ID"],
  },
  {
    label: "TikTok",
    keys: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_ACCESS_TOKEN", "TIKTOK_REFRESH_TOKEN"],
  },
];
