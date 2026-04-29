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

    const userPrompt = `Subreddit: r/${post.subreddit}
Post title (will be read verbatim — do NOT rewrite): ${post.title}
Post has a body: ${hasBody ? "yes (will be read verbatim after the title)" : "no — title-only post"}
Number of comments to feature: ${comments.length}
Lane description: ${lane.description}

Generate the opener, closer, and publishing metadata.`;

    const reply = await context.llm.generateJSON<LlmReply>(SYSTEM_PROMPT, userPrompt);

    const segments: RedditStorySegment[] = [];
    let idx = 0;
    segments.push({ index: idx++, kind: "intro", text: reply.opener.trim() });
    segments.push({ index: idx++, kind: "question", text: post.title.trim() });
    if (hasBody) {
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

    const totalDurationEstimateSeconds = segments.reduce(
      (sum, s) => sum + estimateDurationSeconds(s.text),
      0,
    );

    const script: RedditStoryScript = {
      post,
      segments,
      totalDurationEstimateSeconds,
      publishMeta: reply.publishMeta,
    };

    state.redditScript = script;
    log(
      this.name,
      `Script: ${segments.length} segments, ~${totalDurationEstimateSeconds.toFixed(1)}s estimated`,
    );
  }
}
