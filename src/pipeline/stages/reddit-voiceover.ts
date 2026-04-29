import path from "node:path";
import fs from "node:fs";
import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type {
  PipelineState,
  RedditStorySegment,
  WordTiming,
} from "../../domain/models.js";
import type { CommentVoiceMode } from "../../domain/channel-profile.js";
import { log } from "../../utils/logger.js";
import { alignTimingsToOriginal, prepareTextForTts } from "../../utils/text-prep.js";

function offsetTimings(timings: WordTiming[] | undefined, offsetMs: number): WordTiming[] {
  if (!timings) return [];
  return timings.map((t) => ({
    text: t.text,
    startMs: t.startMs + offsetMs,
    endMs: t.endMs + offsetMs,
  }));
}

function safeSegmentName(seg: RedditStorySegment): string {
  return `voice-${String(seg.index).padStart(2, "0")}-${seg.kind}.mp3`;
}

function hashString(s: string): number {
  // Simple deterministic hash (FNV-like). Stable across runs.
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h | 0);
}

function pickCommentVoice(
  seg: RedditStorySegment,
  pool: string[],
  mode: CommentVoiceMode,
  commentIndex: number,
): string {
  switch (mode) {
    case "by-author": {
      const key = seg.author && seg.author.length > 0 ? seg.author : `idx-${seg.index}`;
      return pool[hashString(key) % pool.length];
    }
    case "round-robin":
      return pool[commentIndex % pool.length];
    case "random":
    default:
      return pool[Math.floor(Math.random() * pool.length)];
  }
}

export class RedditVoiceoverStage implements PipelineStage {
  readonly name = "reddit-voiceover";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    const script = state.redditScript;
    if (!script) throw new Error("No redditScript in pipeline state");
    if (!context.assembler.concatenateAudio) {
      throw new Error(
        "Configured VideoAssembler does not implement concatenateAudio (required by reddit-story)",
      );
    }

    const segmentAudioPaths: string[] = [];
    let cumulativeMs = 0;

    const rateMultiplier = script.rateMultiplier ?? 1;
    const laneRotationOptIn = state.lane?.redditConfig?.commentVoiceRotation;
    // Lane override wins over channel-level pool. undefined = inherit (on by default).
    const rotationEnabled = laneRotationOptIn !== false;
    const commentPool = rotationEnabled
      ? (context.profile.commentVoicePool ?? []).filter((v) => v && v.trim().length > 0)
      : [];
    const commentMode: CommentVoiceMode = context.profile.commentVoiceMode ?? "by-author";
    if (commentPool.length > 0) {
      log(
        this.name,
        `Comment voice rotation enabled — pool size ${commentPool.length}, mode "${commentMode}"`,
      );
    } else if (laneRotationOptIn === false) {
      log(this.name, `Comment voice rotation disabled for this lane (lane override)`);
    }
    let commentIndex = 0;

    for (const seg of script.segments) {
      const outPath = path.join(context.workDir, safeSegmentName(seg));
      const voiceOverride =
        seg.kind === "comment" && commentPool.length > 0
          ? pickCommentVoice(seg, commentPool, commentMode, commentIndex++)
          : undefined;
      log(
        this.name,
        `TTS segment ${seg.index} (${seg.kind}, ${seg.text.length} chars)` +
          (voiceOverride ? ` [voice: ${voiceOverride}${seg.author ? ` for u/${seg.author}` : ""}]` : ""),
      );
      const ttsText = prepareTextForTts(seg.text);
      const result = await context.tts.synthesize(ttsText, outPath, { rateMultiplier, voiceOverride });

      // Edge TTS strips the input extension and writes its own filename suffix —
      // capture the path the provider actually produced.
      const actualPath = fs.existsSync(result.audioPath) ? result.audioPath : outPath;

      // The edge-tts library's `getDuration()` returns ~12× too small (likely a
      // unit-conversion bug). Probe the actual file with ffprobe instead so the
      // segment timings and global word-timing offsets match reality.
      const realDurationSeconds = await context.assembler.getAudioDuration(actualPath);

      seg.audioPath = actualPath;
      seg.startSeconds = cumulativeMs / 1000;
      seg.endSeconds = (cumulativeMs + realDurationSeconds * 1000) / 1000;
      // Align tokens to the ORIGINAL segment text so cards/captions render
      // with full grammar even though the TTS dropped non-alphanumeric chars.
      const aligned = alignTimingsToOriginal(result.wordTimings ?? [], seg.text);
      seg.wordTimings = offsetTimings(aligned, cumulativeMs);

      segmentAudioPaths.push(actualPath);
      cumulativeMs += realDurationSeconds * 1000;
    }

    // .m4a not .mp3 — concatenateAudio re-encodes to the spec's audio codec
    // (AAC), which lives in an MP4/M4A container, not the MP3 container.
    const stitchedPath = path.join(context.workDir, "voiceover.m4a");
    await context.assembler.concatenateAudio!(segmentAudioPaths, stitchedPath);
    state.redditVoiceoverPath = stitchedPath;

    const totalSeconds = cumulativeMs / 1000;
    script.totalDurationEstimateSeconds = totalSeconds;
    log(
      this.name,
      `Stitched ${segmentAudioPaths.length} segments -> ${stitchedPath} (${totalSeconds.toFixed(1)}s)`,
    );

    const target = state.lane?.targetDurationSeconds;
    if (target && totalSeconds > target) {
      log(
        this.name,
        `WARNING: actual TTS ${totalSeconds.toFixed(1)}s exceeds target ${target}s — assembly will hard-cap, audio may cut off mid-sentence`,
      );
    }
  }
}
