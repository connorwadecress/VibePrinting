import { EdgeTTS } from "@andresaya/edge-tts";
import type { TtsProvider } from "../../domain/interfaces/tts-provider.js";
import type { VoiceoverResult, SubtitleEntry, WordTiming } from "../../domain/models.js";
import { log } from "../../utils/logger.js";

interface WordBoundary {
  type: string;
  offset: number;
  duration: number;
  text: string;
}

function extractWordTimings(boundaries: WordBoundary[]): WordTiming[] {
  return boundaries
    .filter((b) => b.type !== "Punctuation" && /[a-zA-Z0-9]/.test(b.text))
    .map((b) => ({
      text: b.text,
      startMs: b.offset / 10_000,
      endMs: (b.offset + b.duration) / 10_000,
    }));
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

  async synthesize(text: string, outputDir: string): Promise<VoiceoverResult> {
    log("tts", `Generating voiceover with ${this.voice}...`);

    const tts = new EdgeTTS();
    await tts.synthesize(text, this.voice, { rate: this.rate });

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
