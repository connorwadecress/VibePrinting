/**
 * Abstract LLM client — any provider (Claude, Gemini, OpenAI, etc.)
 * must implement this interface.
 */
export interface LlmClient {
  generateJSON<T>(systemPrompt: string, userPrompt: string): Promise<T>;
}
