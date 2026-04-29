import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type {
  PipelineState,
  PublishMeta,
  RedditStorySegment,
  RedditStoryScript,
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

function estimateDurationSeconds(text: string): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  // Edge TTS at +10% rate ≈ 2.6 wps. Use a slightly conservative 2.4 wps.
  return wordCount / 2.4;
}

function totalEstimate(segments: RedditStorySegment[]): number {
  return segments.reduce((sum, s) => sum + estimateDurationSeconds(s.text), 0);
}

/**
 * Bring the segment list under `targetSeconds` by progressively shedding
 * content the user is most willing to lose:
 *   1. Drop trailing comments (keep at least one — the punchline).
 *   2. Drop the description segment if still over.
 * Always preserves intro / question / outro since they're the frame.
 *
 * Returns the trimmed segments plus a list of human-readable drop reasons
 * for logging. Re-indexing is the caller's job.
 */
function trimSegmentsToTarget(
  segments: RedditStorySegment[],
  targetSeconds: number,
): { segments: RedditStorySegment[]; drops: string[] } {
  const drops: string[] = [];
  const out = segments.slice();

  while (totalEstimate(out) > targetSeconds) {
    const commentIdxs = out
      .map((s, i) => (s.kind === "comment" ? i : -1))
      .filter((i) => i !== -1);
    if (commentIdxs.length <= 1) break;
    const lastIdx = commentIdxs[commentIdxs.length - 1];
    drops.push(`comment by u/${out[lastIdx].author ?? "?"} (${out[lastIdx].text.length} chars)`);
    out.splice(lastIdx, 1);
  }

  if (totalEstimate(out) > targetSeconds) {
    const descIdx = out.findIndex((s) => s.kind === "description");
    if (descIdx !== -1) {
      drops.push(`post body (${out[descIdx].text.length} chars)`);
      out.splice(descIdx, 1);
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

    const rawEstimate = totalEstimate(segments);
    // Aim slightly below the lane target so estimator drift doesn't push
    // us over the hard cap enforced in reddit-assembly.
    const trimTarget = lane.targetDurationSeconds * 0.92;
    const { segments: trimmed, drops } = trimSegmentsToTarget(segments, trimTarget);
    trimmed.forEach((s, i) => (s.index = i));
    const trimmedEstimate = totalEstimate(trimmed);
    if (drops.length > 0) {
      log(
        this.name,
        `Trimmed ${drops.length} segment(s) to fit ${lane.targetDurationSeconds}s target ` +
          `(estimate ${rawEstimate.toFixed(1)}s → ${trimmedEstimate.toFixed(1)}s): dropped ${drops.join(", ")}`,
      );
    }
    if (trimmedEstimate > lane.targetDurationSeconds) {
      log(
        this.name,
        `WARNING: estimate ${trimmedEstimate.toFixed(1)}s still over target ${lane.targetDurationSeconds}s ` +
          `with intro/question/1 comment/outro intact — assembly will hard-cap the final video`,
      );
    }

    const script: RedditStoryScript = {
      post,
      segments: trimmed,
      totalDurationEstimateSeconds: trimmedEstimate,
      publishMeta: reply.publishMeta,
    };

    state.redditScript = script;
    log(
      this.name,
      `Script: ${trimmed.length} segments, ~${trimmedEstimate.toFixed(1)}s estimated (target ${lane.targetDurationSeconds}s)`,
    );
  }
}
