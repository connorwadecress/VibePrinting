import type { ContentLane, TopicCandidate, ShortScript, VoiceoverResult } from "../models.js";

export interface TtsConfigOptions {
  topic: TopicCandidate;
  lane: ContentLane;
  script: ShortScript;
}

/**
 * Abstract TTS provider — synthesize narration text into audio + subtitle timing.
 * Implementations: EdgeTTS, ElevenLabs, Google Cloud TTS, etc.
 */
export interface TtsProvider {
  /**
   * Optional: called before synthesize() so the provider can select the best
   * voice and speed for the topic/script. If not implemented, defaults are used.
   */
  configure?(options: TtsConfigOptions): void;
  synthesize(text: string, outputDir: string): Promise<VoiceoverResult>;
}
