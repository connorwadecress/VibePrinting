import Anthropic from "@anthropic-ai/sdk";
import type { LlmClient } from "../../domain/interfaces/llm-client.js";
import { log } from "../../utils/logger.js";

function extractJson(text: string): string {
  // Strip markdown code fences
  let s = text.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
  // Locate the outermost JSON object or array
  const start = s.search(/[{[]/);
  if (start > 0) s = s.slice(start);
  const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (end !== -1 && end < s.length - 1) s = s.slice(0, end + 1);
  return s;
}

export class ClaudeClient implements LlmClient {
  private readonly client: Anthropic;
  private lastRequestMs = 0;
  private readonly minGapMs = 1000;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = "claude-haiku-4-5-20251001",
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async generateJSON<T>(systemPrompt: string, userPrompt: string): Promise<T> {
    await this.rateLimit();
    log("llm", `Claude request (${this.model})`);

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: systemPrompt + "\n\nRespond with valid JSON only. No markdown, no code fences.",
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    return JSON.parse(extractJson(text)) as T;
  }

  private async rateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestMs;
    if (elapsed < this.minGapMs) {
      await new Promise((r) => setTimeout(r, this.minGapMs - elapsed));
    }
    this.lastRequestMs = Date.now();
  }
}
