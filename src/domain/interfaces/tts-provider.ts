import type { VoiceoverResult } from "../models.js";

/**
 * Abstract TTS provider — synthesize narration text into audio + subtitle timing.
 * Implementations: EdgeTTS, ElevenLabs, Google Cloud TTS, etc.
 */
export interface TtsProvider {
  synthesize(text: string, outputDir: string): Promise<VoiceoverResult>;
}
