import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LlmClient } from "../../domain/interfaces/llm-client.js";
import { log } from "../../utils/logger.js";

export class GeminiClient implements LlmClient {
  private readonly model;
  private lastRequestMs = 0;
  private readonly minGapMs = 4200; // Gemini free tier: 15 RPM

  constructor(
    apiKey: string,
    private readonly modelName: string = "gemini-2.0-flash",
  ) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });
  }

  async generateJSON<T>(systemPrompt: string, userPrompt: string): Promise<T> {
    await this.rateLimit();
    log("llm", `Gemini request (${this.modelName})`);

    const result = await this.model.generateContent({
      systemInstruction: systemPrompt,
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    });

    const text = result.response.text();
    return JSON.parse(text) as T;
  }

  private async rateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestMs;
    if (elapsed < this.minGapMs) {
      await new Promise((r) => setTimeout(r, this.minGapMs - elapsed));
    }
    this.lastRequestMs = Date.now();
  }
}
