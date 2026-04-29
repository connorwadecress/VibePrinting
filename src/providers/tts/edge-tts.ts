import { EdgeTTS } from "@andresaya/edge-tts";
import type { TtsProvider, TtsSynthesizeOptions } from "../../domain/interfaces/tts-provider.js";
import type { VoiceoverResult, SubtitleEntry, WordTiming } from "../../domain/models.js";
import { log } from "../../utils/logger.js";

interface WordBoundary {
  type: string;
  offset: number;
  duration: number;
  text: string;
}

/**
 * Combine the provider's base rate (e.g. "+10%") with an optional speed-up
 * multiplier (e.g. 1.2) into a new Edge TTS rate string. The TTS engine
 * accepts arbitrary signed percentages, but we cap at +50% so the voice
 * stays comprehensible.
 */
function applyRateMultiplier(baseRate: string, multiplier?: number): string {
  if (!multiplier || multiplier === 1) return baseRate;
  const m = baseRate.match(/-?\d+(\.\d+)?/);
  const basePercent = m ? Number(m[0]) : 0;
  const baseFactor = 1 + basePercent / 100;
  const combined = Math.max(0.5, Math.min(1.5, baseFactor * multiplier));
  const newPercent = Math.round((combined - 1) * 100);
  return newPercent >= 0 ? `+${newPercent}%` : `${newPercent}%`;
}

function extractWordTimings(boundaries: WordBoundary[]): WordTiming[] {
  const result: WordTiming[] = [];

  for (const b of boundaries) {
    if (b.type === "Punctuation" || !/[a-zA-Z0-9]/.test(b.text)) {
      // Attach punctuation to the preceding word for natural page breaks
      if (result.length > 0 && /^[.,!?;:\u2014\u2013\u2026]$/.test(b.text)) {
        result[result.length - 1].text += b.text;
      }
      continue;
    }
    result.push({
      text: b.text,
      startMs: b.offset / 10_000,
      endMs: (b.offset + b.duration) / 10_000,
    });
  }

  return result;
}

function buildSubtitles(boundaries: WordBoundary[], totalDuration: number): SubtitleEntry[] {
  if (boundaries.length === 0) return [];

  // Keep only real word events — drop Punctuation type and anything with no alphanumeric chars
  const words = boundaries.filter(
    (b) => b.type !== "Punctuation" && /[a-zA-Z0-9]/.test(b.text),
  );

  const entries: SubtitleEntry[] = [];
  const chunkSize = 5;

  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize);
    const first = chunk[0];
    const last = chunk[chunk.length - 1];

    const startSec = first.offset / 10_000_000;
    const endSec = (last.offset + last.duration) / 10_000_000;
    const text = chunk.map((w) => w.text).join(" ");

    entries.push({ start: startSec, end: endSec, text });
  }

  return entries;
}

export class EdgeTtsProvider implements TtsProvider {
  constructor(
    private readonly voice: string = "en-US-GuyNeural",
    private readonly rate: string = "+10%",
  ) {}

  async synthesize(
    text: string,
    outputDir: string,
    options?: TtsSynthesizeOptions,
  ): Promise<VoiceoverResult> {
    const effectiveRate = applyRateMultiplier(this.rate, options?.rateMultiplier);
    log(
      "tts",
      `Generating voiceover with ${this.voice} at ${effectiveRate}` +
        (options?.rateMultiplier && options.rateMultiplier !== 1
          ? ` (×${options.rateMultiplier.toFixed(2)} fit-to-target)`
          : ""),
    );

    const tts = new EdgeTTS();
    await tts.synthesize(text, this.voice, { rate: effectiveRate });

    const basePath = outputDir.replace(/\.[^.]+$/, "");
    const savedPath = await tts.toFile(basePath);
    log("tts", `Audio saved to: ${savedPath}`);

    const durationSeconds = tts.getDuration();
    log("tts", `Audio duration: ${durationSeconds.toFixed(1)}s`);

    const wordBoundaries = tts.getWordBoundaries();
    const subtitles = buildSubtitles(wordBoundaries, durationSeconds);
    const wordTimings = extractWordTimings(wordBoundaries);

    return { audioPath: savedPath, durationSeconds, subtitles, wordTimings };
  }
}
