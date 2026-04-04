import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import type { AppConfig, LlmProvider } from "../config.js";
import { log } from "../utils/logger.js";

export interface LlmClient {
  generateJSON<T>(systemPrompt: string, userPrompt: string): Promise<T>;
}

let lastRequestMs = 0;

async function rateLimit(provider: LlmProvider): Promise<void> {
  // Gemini free tier: 15 RPM = 4s gap; Claude: 5 RPM on free = 12s gap, but paid tiers are fine
  const minGapMs = provider === "gemini" ? 4200 : 1000;
  const elapsed = Date.now() - lastRequestMs;
  if (elapsed < minGapMs) {
    await new Promise((r) => setTimeout(r, minGapMs - elapsed));
  }
  lastRequestMs = Date.now();
}

function createGeminiClient(config: AppConfig): LlmClient {
  const genAI = new GoogleGenerativeAI(config.geminiApiKey!);
  const model = genAI.getGenerativeModel({
    model: config.geminiModel,
    generationConfig: { responseMimeType: "application/json" },
  });

  return {
    async generateJSON<T>(systemPrompt: string, userPrompt: string): Promise<T> {
      await rateLimit("gemini");
      log("llm", `Gemini request (${config.geminiModel})`);
      const result = await model.generateContent({
        systemInstruction: systemPrompt,
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      });
      const text = result.response.text();
      return JSON.parse(text) as T;
    },
  };
}

function createClaudeClient(config: AppConfig): LlmClient {
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  return {
    async generateJSON<T>(systemPrompt: string, userPrompt: string): Promise<T> {
      await rateLimit("claude");
      log("llm", `Claude request (${config.claudeModel})`);
      const message = await client.messages.create({
        model: config.claudeModel,
        max_tokens: 2048,
        system: systemPrompt + "\n\nRespond with valid JSON only. No markdown, no code fences.",
        messages: [{ role: "user", content: userPrompt }],
      });
      const text = message.content[0].type === "text" ? message.content[0].text : "";
      // Strip possible markdown fences
      const cleaned = text.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
      return JSON.parse(cleaned) as T;
    },
  };
}

export function createLlmClient(config: AppConfig): LlmClient {
  if (config.llmProvider === "claude") {
    if (!config.anthropicApiKey) throw new Error("ANTHROPIC_API_KEY required when LLM_PROVIDER=claude");
    return createClaudeClient(config);
  }
  if (!config.geminiApiKey) throw new Error("GEMINI_API_KEY required when LLM_PROVIDER=gemini");
  return createGeminiClient(config);
}
