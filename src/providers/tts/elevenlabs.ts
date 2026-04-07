import fs from "node:fs";
import type { TtsProvider, TtsConfigOptions } from "../../domain/interfaces/tts-provider.js";
import type { VoiceoverResult, SubtitleEntry, WordTiming } from "../../domain/models.js";
import { log } from "../../utils/logger.js";

// --- Voice roster -----------------------------------------------------------
// Each voice is tagged with content archetypes. Tags are matched against the
// lane description + topic title/question to pick the best fit.

interface VoiceProfile {
  id: string;
  name: string;
  tags: string[];
}

const VOICE_ROSTER: VoiceProfile[] = [
  {
    id: "pNInz6obpgDQGcFmaJgB",
    name: "Adam",
    tags: ["history", "serious", "authoritative", "war", "politics", "facts", "documentary"],
  },
  {
    id: "TxGEqnHWrfWFTfGW9XjX",
    name: "Josh",
    tags: ["documentary", "narrative", "mystery", "crime", "investigation", "story"],
  },
  {
    id: "VR6AewLTigWG4xSOukaG",
    name: "Arnold",
    tags: ["science", "tech", "space", "engineering", "ai", "data", "research"],
  },
  {
    id: "ErXwobaYiN019PkySvjV",
    name: "Antoni",
    tags: ["culture", "philosophy", "psychology", "mindset", "society", "human", "behavior"],
  },
  {
    id: "AZnzlk1XvdvUeBnXmlld",
    name: "Domi",
    tags: ["motivation", "energy", "hustle", "success", "productivity", "entrepreneur", "bold"],
  },
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Bella",
    tags: ["lifestyle", "wellness", "health", "beauty", "calm", "soft", "personal"],
  },
  {
    id: "MF3mGyEYCl7XYWbV9V6O",
    name: "Elli",
    tags: ["viral", "entertainment", "fun", "pop", "celebrity", "trending", "young"],
  },
  {
    id: "21m00Tcm4TlvDq8ikWAM",
    name: "Rachel",
    tags: ["educational", "explainer", "general", "clear", "neutral", "finance", "business"],
  },
];

// Natural speaking rate at ElevenLabs speed=1.0 (words per second, empirically tuned)
const NATURAL_WPS = 2.7;
// Target video duration window
const TARGET_MIN_S = 30;
const TARGET_MAX_S = 45;
const TARGET_S = (TARGET_MIN_S + TARGET_MAX_S) / 2; // 37.5s midpoint
// ElevenLabs speed clamp range
const SPEED_MIN = 0.75;
const SPEED_MAX = 1.2;

function selectVoice(options: TtsConfigOptions, fallbackVoiceId: string): string {
  const haystack = [
    options.lane.id,
    options.lane.description,
    options.topic.titleAngle,
    options.topic.seedQuestion,
    options.topic.laneId,
  ]
    .join(" ")
    .toLowerCase();

  let bestVoice = VOICE_ROSTER.find((v) => v.id === fallbackVoiceId) ?? VOICE_ROSTER[7]; // Rachel fallback
  let bestScore = 0;

  for (const voice of VOICE_ROSTER) {
    const score = voice.tags.filter((tag) => haystack.includes(tag)).length;
    if (score > bestScore) {
      bestScore = score;
      bestVoice = voice;
    }
  }

  log("tts", `Voice selected: ${bestVoice.name} (${bestScore} tag match${bestScore !== 1 ? "es" : ""})`);
  return bestVoice.id;
}

function calcSpeed(script: TtsConfigOptions["script"]): number {
  const parts = [script.hook, ...script.beats.map((b) => b.narration), script.payoff];
  const wordCount = parts.join(" ").split(/\s+/).filter(Boolean).length;
  const requiredSpeed = wordCount / (TARGET_S * NATURAL_WPS);
  const clamped = Math.max(SPEED_MIN, Math.min(SPEED_MAX, requiredSpeed));
  const estDuration = wordCount / (NATURAL_WPS * clamped);
  log(
    "tts",
    `Script: ${wordCount} words → speed ${clamped.toFixed(2)}x → est. ${estDuration.toFixed(1)}s (target ${TARGET_MIN_S}-${TARGET_MAX_S}s)`,
  );
  return clamped;
}

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
  private activeVoiceId: string;
  private activeSpeed: number;

  constructor(
    private readonly apiKey: string,
    /** Voice ID — default used when no topic context is available */
    private readonly defaultVoiceId: string = "21m00Tcm4TlvDq8ikWAM", // Rachel: clear, natural
    private readonly modelId: string = "eleven_turbo_v2_5",
    private readonly defaultSpeed: number = 1.0,
  ) {
    this.activeVoiceId = defaultVoiceId;
    this.activeSpeed = defaultSpeed;
  }

  configure(options: TtsConfigOptions): void {
    this.activeVoiceId = selectVoice(options, this.defaultVoiceId);
    this.activeSpeed = calcSpeed(options.script);
  }

  async synthesize(text: string, outputPath: string): Promise<VoiceoverResult> {
    log("tts", `Generating voiceover with ElevenLabs voice ${this.activeVoiceId} at speed ${this.activeSpeed.toFixed(2)}x...`);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${this.activeVoiceId}/with-timestamps`,
      {
        method: "POST",
        headers: {
          "xi-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: this.modelId,
          voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: this.activeSpeed },
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
