import type { AppConfig } from "../../config.js";
import type { LlmClient } from "../../domain/interfaces/llm-client.js";
import { ClaudeClient } from "./claude.js";
import { GeminiClient } from "./gemini.js";
import { MockLlmClient } from "./mock.js";

export function createLlmClient(config: AppConfig): LlmClient {
  if (config.llmProvider === "mock") {
    return new MockLlmClient();
  }

  if (config.llmProvider === "claude") {
    if (!config.anthropicApiKey) throw new Error("ANTHROPIC_API_KEY required when LLM_PROVIDER=claude");
    return new ClaudeClient(config.anthropicApiKey, config.claudeModel);
  }

  if (!config.geminiApiKey) throw new Error("GEMINI_API_KEY required when LLM_PROVIDER=gemini");
  return new GeminiClient(config.geminiApiKey, config.geminiModel);
}
