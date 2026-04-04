import { EdgeTTS } from "@andresaya/edge-tts";
import type { VoiceoverResult, SubtitleEntry } from "../domain/models.js";
import { log } from "../utils/logger.js";

export async function generateVoiceover(
  narrationText: string,
  outputPath: string,
  voice: string = "en-US-GuyNeural",
  rate: string = "+10%",
): Promise<VoiceoverResult> {
  log("tts", `Generating voiceover with ${voice}...`);

  const tts = new EdgeTTS();
  await tts.synthesize(narrationText, voice, { rate });

  // Strip extension — the package auto-appends based on format
  const basePath = outputPath.replace(/\.[^.]+$/, "");
  const savedPath = await tts.toFile(basePath);
  log("tts", `Audio saved to: ${savedPath}`);

  const durationSeconds = tts.getDuration();
  log("tts", `Audio duration: ${durationSeconds.toFixed(1)}s`);

  // Get word boundaries for subtitle timing
  const wordBoundaries = tts.getWordBoundaries();
  const subtitles = buildSubtitles(wordBoundaries, durationSeconds);

  return { audioPath: savedPath, durationSeconds, subtitles };
}

interface WordBoundary {
  type: string;
  offset: number;
  duration: number;
  text: string;
}

function buildSubtitles(boundaries: WordBoundary[], totalDuration: number): SubtitleEntry[] {
  if (boundaries.length === 0) {
    return [];
  }

  // Group words into subtitle chunks of ~6-8 words
  const entries: SubtitleEntry[] = [];
  const chunkSize = 7;

  for (let i = 0; i < boundaries.length; i += chunkSize) {
    const chunk = boundaries.slice(i, i + chunkSize);
    const first = chunk[0];
    const last = chunk[chunk.length - 1];

    // Offsets are in 100-nanosecond units (ticks)
    const startSec = first.offset / 10_000_000;
    const endSec = (last.offset + last.duration) / 10_000_000;
    const text = chunk.map((w) => w.text).join(" ");

    entries.push({ start: startSec, end: endSec, text });
  }

  return entries;
}
