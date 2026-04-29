import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { ChannelProfile } from "../../domain/channel-profile.js";
import type {
  PipelineState,
  PublishMeta,
  RedditStorySegment,
  RedditStoryScript,
  TrimPriority,
} from "../../domain/models.js";
import { log } from "../../utils/logger.js";

const SYSTEM_PROMPT = `You write the framing narration for Reddit-story short videos.
The video format is: an opener -> the post title (read verbatim) -> [optional post body, if the post has one] -> N user comments (read verbatim) -> a closer.

You only generate the OPENER and CLOSER text plus publishing metadata.
Do NOT rewrite or summarize the post title, post body, or comments — those are read verbatim and you do not need to produce them.

Style rules:
- Opener: ONE short sentence (max 12 words) introducing the post in a punchy way. Examples: "Reddit just asked:" or "People shared the worst time they ever met the in-laws:" or "Here are the wildest answers from r/AskReddit:".
- Closer: ONE short sentence (max 12 words) inviting the viewer to engage. Examples: "Which one would have made you walk out? Tell me." or "Drop yours below and follow for more."
- youtubeTitle: punchy 6-12 word title that surfaces the question; max 70 characters total. Do not include "Reddit Story" branding twice.
- youtubeDescription: 2-4 sentences; mention r/<subreddit>; end with a subscribe CTA.
- topicTags: 6-10 short, searchable tags (e.g. ["askreddit","reddit stories","funny","relationships"]).
- topicHashtags: 3-5 hashtags. ALWAYS include "#Shorts" and "#reddit".

Respond with JSON: {
  "opener": string,
  "closer": string,
  "publishMeta": {
    "youtubeTitle": string,
    "youtubeDescription": string,
    "topicTags": string[],
    "topicHashtags": string[]
  }
}`;

interface LlmReply {
  opener: string;
  closer: string;
  publishMeta: PublishMeta;
}

/**
 * Words-per-second estimate for the active TTS provider. Used to decide
 * how many segments will fit before assembly. Over-estimating wps trims
 * too few comments → audio overruns target. Under-estimating trims too
 * many → final video is short and sparse.
 *
 * Calibrated against real ElevenLabs (speed 1.15) and Edge TTS (+10%) runs.
 * If the operator reports drift, tune here, NOT by changing target.
 */
function wordsPerSecondFor(profile: ChannelProfile): number {
  const provider = profile.ttsProvider ?? "edge";
  if (provider === "elevenlabs") {
    const speed = profile.ttsProviderSettings?.elevenLabs?.speed ?? 1;
    // ElevenLabs base voice ≈ 2.7 wps; speed multiplier scales linearly.
    // Slight conservative cushion (×0.95) so we under-trim rather than over.
    return 2.7 * speed * 0.95;
  }
  // Edge TTS at +10% rate ≈ 2.6 wps measured. Conservative 2.4 wps.
  return 2.4;
}

function estimateDurationSeconds(text: string, wps: number): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return wordCount / wps;
}

function totalEstimate(segments: RedditStorySegment[], wps: number): number {
  return segments.reduce((sum, s) => sum + estimateDurationSeconds(s.text, wps), 0);
}

function dropLastComment(segments: RedditStorySegment[]): string | null {
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].kind === "comment") {
      const seg = segments[i];
      segments.splice(i, 1);
      return `comment by u/${seg.author ?? "?"} (${seg.text.length} chars)`;
    }
  }
  return null;
}

function dropBody(segments: RedditStorySegment[]): string | null {
  const idx = segments.findIndex((s) => s.kind === "description");
  if (idx === -1) return null;
  const seg = segments[idx];
  segments.splice(idx, 1);
  return `post body (${seg.text.length} chars)`;
}

function commentCount(segments: RedditStorySegment[]): number {
  return segments.reduce((n, s) => (s.kind === "comment" ? n + 1 : n), 0);
}

/**
 * Bring the segment list under `targetSeconds` by shedding the content
 * type the lane considers least load-bearing first.
 *
 *  - "comments": drop trailing comments down to zero before touching the
 *    body. Use for body-is-the-story subs (TIFU, AITA) so the post body
 *    survives even when comments have to be cut entirely.
 *  - "body": drop the body before touching comments, then drop trailing
 *    comments down to one. Use when comments carry the punchline.
 *  - "balanced" (default): drop trailing comments down to one, then drop
 *    the body if still over.
 *
 * Always preserves intro / question / outro. Returns the trimmed list
 * plus human-readable drop reasons for logging.
 */
function trimSegmentsToTarget(
  segments: RedditStorySegment[],
  targetSeconds: number,
  priority: TrimPriority,
  wps: number,
): { segments: RedditStorySegment[]; drops: string[] } {
  const drops: string[] = [];
  const out = segments.slice();

  if (priority === "comments") {
    // Body is the story for this lane — never drop it, even if the body
    // alone exceeds the target. Drop trailing comments down to zero;
    // anything still over after that is the speed-up fallback's problem,
    // and the assembly hard-cap is the last line of defense. Producing a
    // body-cutoff video is always better than producing an empty one.
    while (totalEstimate(out, wps) > targetSeconds && commentCount(out) > 0) {
      const dropped = dropLastComment(out);
      if (!dropped) break;
      drops.push(dropped);
    }
  } else if (priority === "body") {
    if (totalEstimate(out, wps) > targetSeconds) {
      const dropped = dropBody(out);
      if (dropped) drops.push(dropped);
    }
    while (totalEstimate(out, wps) > targetSeconds && commentCount(out) > 1) {
      const dropped = dropLastComment(out);
      if (!dropped) break;
      drops.push(dropped);
    }
  } else {
    // balanced: trim trailing comments down to 1, then drop body, then
    // trim further comments to 0 if somehow still over.
    while (totalEstimate(out, wps) > targetSeconds && commentCount(out) > 1) {
      const dropped = dropLastComment(out);
      if (!dropped) break;
      drops.push(dropped);
    }
    if (totalEstimate(out, wps) > targetSeconds) {
      const dropped = dropBody(out);
      if (dropped) drops.push(dropped);
    }
    while (totalEstimate(out, wps) > targetSeconds && commentCount(out) > 0) {
      const dropped = dropLastComment(out);
      if (!dropped) break;
      drops.push(dropped);
    }
  }

  return { segments: out, drops };
}

export class RedditScriptStage implements PipelineStage {
  readonly name = "reddit-script";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    const post = state.redditPost;
    const comments = state.redditComments;
    const lane = state.lane;
    if (!post) throw new Error("No reddit post in pipeline state");
    if (!comments || comments.length === 0) throw new Error("No reddit comments in pipeline state");
    if (!lane) throw new Error("No lane in pipeline state");

    log(this.name, `Writing framing script for "${post.title}"`);

    const selftext = post.selftext?.trim() ?? "";
    const hasBody = selftext.length > 0;
    const showDescription = lane.redditConfig?.showDescription === true;
    const includeBody = showDescription && hasBody;
    log(
      this.name,
      `r/${post.subreddit}: showDescription=${showDescription}, hasBody=${hasBody} → includeBody=${includeBody}`,
    );

    const userPrompt = `Subreddit: r/${post.subreddit}
Post title (will be read verbatim — do NOT rewrite): ${post.title}
Post has a body: ${includeBody ? "yes (will be read verbatim after the title)" : "no — title-only post"}
Number of comments to feature: ${comments.length}
Lane description: ${lane.description}

Generate the opener, closer, and publishing metadata.`;

    const reply = await context.llm.generateJSON<LlmReply>(SYSTEM_PROMPT, userPrompt);

    const segments: RedditStorySegment[] = [];
    let idx = 0;
    segments.push({ index: idx++, kind: "intro", text: reply.opener.trim() });
    segments.push({ index: idx++, kind: "question", text: post.title.trim() });
    if (includeBody) {
      segments.push({
        index: idx++,
        kind: "description",
        text: selftext,
        author: post.author,
        score: post.score,
      });
      log(this.name, `Including post body (${selftext.length} chars) by u/${post.author}`);
    }
    for (const c of comments) {
      segments.push({
        index: idx++,
        kind: "comment",
        text: c.body,
        author: c.author,
        score: c.score,
      });
    }
    segments.push({ index: idx++, kind: "outro", text: reply.closer.trim() });

    const wps = wordsPerSecondFor(context.profile);
    log(this.name, `Estimator wps=${wps.toFixed(2)} (provider=${context.profile.ttsProvider ?? "edge"})`);

    const rawEstimate = totalEstimate(segments, wps);
    // Aim slightly below the lane target so estimator drift doesn't push
    // us over the hard cap enforced in reddit-assembly.
    const trimTarget = lane.targetDurationSeconds * 0.92;
    const priority: TrimPriority = lane.redditConfig?.trimPriority ?? "balanced";
    const { segments: trimmed, drops } = trimSegmentsToTarget(segments, trimTarget, priority, wps);
    trimmed.forEach((s, i) => (s.index = i));
    const trimmedEstimate = totalEstimate(trimmed, wps);
    if (drops.length > 0) {
      log(
        this.name,
        `Trimmed ${drops.length} segment(s) (priority=${priority}) to fit ${lane.targetDurationSeconds}s target ` +
          `(estimate ${rawEstimate.toFixed(1)}s → ${trimmedEstimate.toFixed(1)}s): dropped ${drops.join(", ")}`,
      );
    }

    // Speed-up fallback: if trimming alone couldn't get us under target and
    // the lane allows some TTS speed-up, compute the multiplier needed and
    // bound it by maxSpeedupPercent. The voiceover stage applies this to
    // every TTS call for this run.
    let rateMultiplier = 1;
    const maxSpeedup = lane.redditConfig?.maxSpeedupPercent ?? 0;
    if (trimmedEstimate > lane.targetDurationSeconds && maxSpeedup > 0) {
      const needed = trimmedEstimate / lane.targetDurationSeconds;
      const cap = 1 + maxSpeedup / 100;
      rateMultiplier = Math.min(needed, cap);
      log(
        this.name,
        `Speed-up fallback: rate ×${rateMultiplier.toFixed(2)} ` +
          `(needed ×${needed.toFixed(2)}, cap ×${cap.toFixed(2)}) to fit ${lane.targetDurationSeconds}s target`,
      );
    }

    const effectiveEstimate = trimmedEstimate / rateMultiplier;
    if (effectiveEstimate > lane.targetDurationSeconds) {
      log(
        this.name,
        `WARNING: estimate ${effectiveEstimate.toFixed(1)}s still over target ${lane.targetDurationSeconds}s ` +
          `after trimming and speed-up — assembly will hard-cap the final video`,
      );
    }

    const script: RedditStoryScript = {
      post,
      segments: trimmed,
      totalDurationEstimateSeconds: effectiveEstimate,
      rateMultiplier: rateMultiplier !== 1 ? rateMultiplier : undefined,
      publishMeta: reply.publishMeta,
    };

    state.redditScript = script;
    log(
      this.name,
      `Script: ${trimmed.length} segments, ~${effectiveEstimate.toFixed(1)}s estimated (target ${lane.targetDurationSeconds}s)`,
    );
  }
}
