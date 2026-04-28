/**
 * Shared constants and types for brand .env management.
 * No Node.js imports — safe to use in both server and client code.
 */

export const BRAND_ENV_WHITELIST = [
  // LLM
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  // TTS
  "ELEVENLABS_API_KEY",
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
    keys: ["ANTHROPIC_API_KEY", "GEMINI_API_KEY"],
  },
  {
    label: "Text-to-speech",
    keys: ["ELEVENLABS_API_KEY"],
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
