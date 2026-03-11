export interface AppConfig {
  defaultDailyTarget: number;
  defaultTheme: string;
  n8nApiKey?: string;
  n8nBaseUrl?: string;
  n8nScopeFile: string;
  n8nWorkflowPrefix: string;
  openAiApiKey?: string;
  openAiFastModel: string;
  openAiTextModel: string;
  openAiTtsModel: string;
  openAiVideoModel: string;
  youTubeChannelId?: string;
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
    defaultDailyTarget: readInt("DEFAULT_DAILY_TARGET", 3),
    defaultTheme: readEnv("DEFAULT_CHANNEL_THEME") ?? "compressed-curiosity",
    n8nApiKey: readEnv("N8N_API_KEY"),
    n8nBaseUrl: readEnv("N8N_BASE_URL"),
    n8nScopeFile: readEnv("N8N_SCOPE_FILE") ?? "n8n.scope.json",
    n8nWorkflowPrefix: readEnv("N8N_WORKFLOW_PREFIX") ?? "Vibe Printing -",
    openAiApiKey: readEnv("OPENAI_API_KEY"),
    openAiFastModel: readEnv("OPENAI_FAST_MODEL") ?? "gpt-4o-mini",
    openAiTextModel: readEnv("OPENAI_TEXT_MODEL") ?? "gpt-5.1",
    openAiTtsModel: readEnv("OPENAI_TTS_MODEL") ?? "tts-1",
    openAiVideoModel: readEnv("OPENAI_VIDEO_MODEL") ?? "sora-2",
    youTubeChannelId: readEnv("YOUTUBE_CHANNEL_ID")
  };
}
