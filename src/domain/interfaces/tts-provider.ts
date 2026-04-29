import type { VoiceoverResult } from "../models.js";

export interface TtsSynthesizeOptions {
  /** Multiplier applied on top of the provider's configured rate/speed.
   *  1.0 = use the configured rate; 1.2 = read 20% faster. Used by the
   *  reddit-story pipeline as a last-resort fit-to-target fallback. */
  rateMultiplier?: number;

  /** One-shot voice override for this synthesis call only. Format depends
   *  on the provider — ElevenLabs expects a voice ID (e.g. "8IbUB2LiiCZ85IJAHNnZ"),
   *  Edge TTS expects a voice name (e.g. "en-US-AriaNeural"). Used by
   *  reddit-story to randomize voices per comment without changing the
   *  configured narrator voice. */
  voiceOverride?: string;
}

/**
 * Abstract TTS provider — synthesize narration text into audio + subtitle timing.
 * Implementations: EdgeTTS, ElevenLabs, Google Cloud TTS, etc.
 */
export interface TtsProvider {
  synthesize(
    text: string,
    outputDir: string,
    options?: TtsSynthesizeOptions,
  ): Promise<VoiceoverResult>;
}
