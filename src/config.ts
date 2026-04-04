export type LlmProvider = "gemini" | "claude";

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
  ttsVoice: string;
  ttsRate: string;

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

  // Local paths
  outputDir: string;
  tempDir: string;

  // Channel
  defaultDailyTarget: number;
  defaultTheme: string;

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

    ttsVoice: readEnv("TTS_VOICE") ?? "en-US-GuyNeural",
    ttsRate: readEnv("TTS_RATE") ?? "+10%",

    youTubeChannelId: readEnv("YOUTUBE_CHANNEL_ID"),
    youTubeClientId: readEnv("YOUTUBE_CLIENT_ID"),
    youTubeClientSecret: readEnv("YOUTUBE_CLIENT_SECRET"),
    youTubeRefreshToken: readEnv("YOUTUBE_REFRESH_TOKEN"),

    tikTokClientKey: readEnv("TIKTOK_CLIENT_KEY"),
    tikTokClientSecret: readEnv("TIKTOK_CLIENT_SECRET"),
    tikTokAccessToken: readEnv("TIKTOK_ACCESS_TOKEN"),
    tikTokRefreshToken: readEnv("TIKTOK_REFRESH_TOKEN"),

    outputDir: readEnv("OUTPUT_DIR") ?? "./output",
    tempDir: readEnv("TEMP_DIR") ?? "./output/.tmp",

    defaultDailyTarget: readInt("DEFAULT_DAILY_TARGET", 3),
    defaultTheme: readEnv("DEFAULT_CHANNEL_THEME") ?? "compressed-curiosity",

    n8nApiKey: readEnv("N8N_API_KEY"),
    n8nBaseUrl: readEnv("N8N_BASE_URL"),
    n8nScopeFile: readEnv("N8N_SCOPE_FILE") ?? "n8n.scope.json",
    n8nWorkflowPrefix: readEnv("N8N_WORKFLOW_PREFIX") ?? "Vibe Printing -",
  };
}
