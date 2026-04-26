export type LlmProvider = "gemini" | "claude" | "mock";

export interface AppConfig {
  // LLM provider selection
  llmProvider: LlmProvider;

  // Gemini (free tier)
  geminiApiKey?: string;
  geminiModel: string;

  // Claude / Anthropic
  anthropicApiKey?: string;
  claudeModel: string;

  // Stock footage
  pexelsApiKey?: string;

  // TTS
  ttsProvider: string;
  ttsVoice: string;
  ttsRate: string;
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
  elevenLabsModelId?: string;
  elevenLabsSpeed: number;

  // YouTube (optional, for upload)
  youTubeChannelId?: string;
  youTubeClientId?: string;
  youTubeClientSecret?: string;
  youTubeRefreshToken?: string;

  // TikTok (optional, for upload via Content Posting API)
  tikTokClientKey?: string;
  tikTokClientSecret?: string;
  tikTokAccessToken?: string;
  tikTokRefreshToken?: string;

  // Footage quality
  llmReranking: boolean;

  // Local paths
  outputDir: string;
  tempDir: string;

  // Channel
  defaultDailyTarget: number;

  // Legacy n8n (kept for existing code)
  n8nApiKey?: string;
  n8nBaseUrl?: string;
  n8nScopeFile: string;
  n8nWorkflowPrefix: string;
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function readInt(name: string, fallback: number): number {
  const value = readEnv(name);
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(): AppConfig {
  return {
    llmProvider: (readEnv("LLM_PROVIDER") ?? "claude") as LlmProvider,

    geminiApiKey: readEnv("GEMINI_API_KEY"),
    geminiModel: readEnv("GEMINI_MODEL") ?? "gemini-2.0-flash",

    anthropicApiKey: readEnv("ANTHROPIC_API_KEY"),
    claudeModel: readEnv("CLAUDE_MODEL") ?? "claude-haiku-4-5-20251001",

    pexelsApiKey: readEnv("PEXELS_API_KEY"),

    ttsProvider: readEnv("TTS_PROVIDER") ?? "edge",
    ttsVoice: readEnv("TTS_VOICE") ?? "en-US-GuyNeural",
    ttsRate: readEnv("TTS_RATE") ?? "+10%",
    elevenLabsApiKey: readEnv("ELEVENLABS_API_KEY"),
    elevenLabsVoiceId: readEnv("ELEVENLABS_VOICE_ID"),
    elevenLabsModelId: readEnv("ELEVENLABS_MODEL_ID"),
    elevenLabsSpeed: Number(readEnv("ELEVENLABS_SPEED") ?? "1.15"),

    youTubeChannelId: readEnv("YOUTUBE_CHANNEL_ID"),
    youTubeClientId: readEnv("YOUTUBE_CLIENT_ID"),
    youTubeClientSecret: readEnv("YOUTUBE_CLIENT_SECRET"),
    youTubeRefreshToken: readEnv("YOUTUBE_REFRESH_TOKEN"),

    tikTokClientKey: readEnv("TIKTOK_CLIENT_KEY"),
    tikTokClientSecret: readEnv("TIKTOK_CLIENT_SECRET"),
    tikTokAccessToken: readEnv("TIKTOK_ACCESS_TOKEN"),
    tikTokRefreshToken: readEnv("TIKTOK_REFRESH_TOKEN"),

    llmReranking: readEnv("LLM_RERANKING") === "true",

    outputDir: readEnv("OUTPUT_DIR") ?? "./output",
    tempDir: readEnv("TEMP_DIR") ?? "./output/.tmp",

    defaultDailyTarget: readInt("DEFAULT_DAILY_TARGET", 3),

    n8nApiKey: readEnv("N8N_API_KEY"),
    n8nBaseUrl: readEnv("N8N_BASE_URL"),
    n8nScopeFile: readEnv("N8N_SCOPE_FILE") ?? "n8n.scope.json",
    n8nWorkflowPrefix: readEnv("N8N_WORKFLOW_PREFIX") ?? "Vibe Printing -",
  };
}
