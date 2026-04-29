import fs from "node:fs";
import type { TtsProvider, TtsSynthesizeOptions } from "../../domain/interfaces/tts-provider.js";
import type { VoiceoverResult, SubtitleEntry, WordTiming } from "../../domain/models.js";
import { log } from "../../utils/logger.js";

interface ElevenLabsAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

interface ElevenLabsResponse {
  audio_base64: string;
  alignment: ElevenLabsAlignment;
}

function extractWordTimings(alignment: ElevenLabsAlignment): WordTiming[] {
  const words: WordTiming[] = [];
  let wordText = "";
  let wordStart: number | null = null;
  let wordEnd = 0;

  for (let i = 0; i < alignment.characters.length; i++) {
    const char = alignment.characters[i];
    const start = alignment.character_start_times_seconds[i];
    const end = alignment.character_end_times_seconds[i];

    if (char === " " || char === "\n") {
      if (wordText && wordStart !== null) {
        words.push({ text: wordText, startMs: wordStart * 1000, endMs: wordEnd * 1000 });
        wordText = "";
        wordStart = null;
      }
    } else {
      if (wordStart === null) wordStart = start;
      wordText += char;
      wordEnd = end;
    }
  }
  if (wordText && wordStart !== null) {
    words.push({ text: wordText, startMs: wordStart * 1000, endMs: wordEnd * 1000 });
  }

  return words.filter((w) => /[a-zA-Z0-9]/.test(w.text));
}

function buildSubtitles(alignment: ElevenLabsAlignment, chunkSize = 5): SubtitleEntry[] {
  const words: { text: string; start: number; end: number }[] = [];
  let wordText = "";
  let wordStart: number | null = null;
  let wordEnd = 0;

  for (let i = 0; i < alignment.characters.length; i++) {
    const char = alignment.characters[i];
    const start = alignment.character_start_times_seconds[i];
    const end = alignment.character_end_times_seconds[i];

    if (char === " " || char === "\n") {
      if (wordText) {
        words.push({ text: wordText, start: wordStart!, end: wordEnd });
        wordText = "";
        wordStart = null;
      }
    } else {
      if (wordStart === null) wordStart = start;
      wordText += char;
      wordEnd = end;
    }
  }
  if (wordText && wordStart !== null) {
    words.push({ text: wordText, start: wordStart, end: wordEnd });
  }

  // Drop any word that is pure punctuation/symbols
  const cleanWords = words.filter((w) => /[a-zA-Z0-9]/.test(w.text));

  const entries: SubtitleEntry[] = [];
  for (let i = 0; i < cleanWords.length; i += chunkSize) {
    const chunk = cleanWords.slice(i, i + chunkSize);
    entries.push({
      start: chunk[0].start,
      end: chunk[chunk.length - 1].end,
      text: chunk.map((w) => w.text).join(" "),
    });
  }
  return entries;
}

export class ElevenLabsProvider implements TtsProvider {
  constructor(
    private readonly apiKey: string,
    /** Voice ID — find yours at elevenlabs.io/voice-library or via GET /v1/voices */
    private readonly voiceId: string = "21m00Tcm4TlvDq8ikWAM", // Rachel: clear, natural
    private readonly modelId: string = "eleven_turbo_v2_5",
    private readonly speed: number = 1.15,
  ) {}

  async synthesize(
    text: string,
    outputPath: string,
    options?: TtsSynthesizeOptions,
  ): Promise<VoiceoverResult> {
    const multiplier = options?.rateMultiplier ?? 1;
    // ElevenLabs caps speed at ~1.5; 1.0–1.5 is the safe range. Combine
    // base speed with the multiplier and clamp.
    const effectiveSpeed = Math.max(0.7, Math.min(1.5, this.speed * multiplier));
    const effectiveVoiceId = options?.voiceOverride ?? this.voiceId;
    log(
      "tts",
      `Generating voiceover with ElevenLabs voice ${effectiveVoiceId} at speed ${effectiveSpeed.toFixed(2)}` +
        (multiplier !== 1 ? ` (×${multiplier.toFixed(2)} fit-to-target)` : ""),
    );

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${effectiveVoiceId}/with-timestamps`,
      {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: this.modelId,
          voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: effectiveSpeed },
        }),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`ElevenLabs API error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as ElevenLabsResponse;

    const audioPath = outputPath.replace(/\.[^.]+$/, ".mp3");
    fs.writeFileSync(audioPath, Buffer.from(data.audio_base64, "base64"));
    log("tts", `Audio saved to: ${audioPath}`);

    const endTimes = data.alignment.character_end_times_seconds;
    const durationSeconds = endTimes[endTimes.length - 1] ?? 0;
    log("tts", `Audio duration: ${durationSeconds.toFixed(1)}s`);

    const subtitles = buildSubtitles(data.alignment, 5);
    const wordTimings = extractWordTimings(data.alignment);

    return { audioPath, durationSeconds, subtitles, wordTimings };
  }
}
