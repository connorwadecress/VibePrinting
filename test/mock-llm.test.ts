import test from "node:test";
import assert from "node:assert/strict";
import { createLlmClient } from "../src/providers/llm/index.js";
import type { AppConfig } from "../src/config.js";

function buildConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    llmProvider: "claude",
    geminiApiKey: undefined,
    geminiModel: "gemini-2.0-flash",
    anthropicApiKey: undefined,
    claudeModel: "claude-haiku-4-5-20251001",
    pexelsApiKey: undefined,
    ttsProvider: "edge",
    ttsVoice: "en-US-GuyNeural",
    ttsRate: "+10%",
    elevenLabsApiKey: undefined,
    elevenLabsVoiceId: undefined,
    elevenLabsModelId: undefined,
    elevenLabsSpeed: 1.15,
    youTubeChannelId: undefined,
    youTubeClientId: undefined,
    youTubeClientSecret: undefined,
    youTubeRefreshToken: undefined,
    tikTokClientKey: undefined,
    tikTokClientSecret: undefined,
    tikTokAccessToken: undefined,
    tikTokRefreshToken: undefined,
    llmReranking: false,
    outputDir: "./output",
    tempDir: "./output/.tmp",
    defaultDailyTarget: 3,
    n8nApiKey: undefined,
    n8nBaseUrl: undefined,
    n8nScopeFile: "n8n.scope.json",
    n8nWorkflowPrefix: "Vibe Printing -",
    ...overrides,
  };
}

test("createLlmClient supports a mock provider without live API keys", async () => {
  const client = createLlmClient(buildConfig({ llmProvider: "mock" as AppConfig["llmProvider"] }));
  const topic = await client.generateJSON<{ laneId: string; titleAngle: string }>("topic researcher", "lane: history-flash");

  assert.equal(topic.laneId, "history-flash");
  assert.match(topic.titleAngle, /roman|concrete|history/i);
});
