import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState, RedditPost } from "../../domain/models.js";
import { fetchPostByUrl, fetchTopPosts } from "../../utils/reddit-client.js";
import { log } from "../../utils/logger.js";

const SYSTEM_PROMPT_BASE = `You pick Reddit posts to turn into short-form videos.
Given a list of candidate posts, return the index (0-based) of the single best one.

Selection rules:
- Strongly prefer posts where the comments will be entertaining, surprising, or relatable.
- Strongly prefer posts that ask a personal-experience question or tell a self-contained story.
- Avoid: politics, medical advice, anything sexual, anything involving real-name celebrities, anything tragic involving children.
- Higher score is a tiebreaker, not the primary signal.`;

const SYSTEM_PROMPT_DURATION_RULE = `

DURATION CONSTRAINT (this lane reads the post body aloud):
- Each candidate is annotated with an estimated read-aloud duration (~bodySec).
- Strongly prefer candidates whose bodySec is comfortably within the lane target.
- Heavily penalize candidates whose bodySec exceeds the target — those will get
  truncated mid-sentence in the final video. A shorter, complete story beats a
  longer story that gets cut off.`;

const RESPONSE_FORMAT = `

Respond with JSON: {"chosenIndex": number, "reason": string}`;

function estimateBodySeconds(post: RedditPost): number {
  const titleWords = post.title.trim().split(/\s+/).filter(Boolean).length;
  const bodyWords = (post.selftext ?? "").trim().split(/\s+/).filter(Boolean).length;
  // 2.4 wps matches the rest of the pipeline. Add ~10s for intro/outro framing.
  return (titleWords + bodyWords) / 2.4 + 10;
}

export class RedditSourceStage implements PipelineStage {
  readonly name = "reddit-source";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    const lane = state.lane;
    if (!lane) throw new Error("No lane in pipeline state");
    const cfg = lane.redditConfig;
    if (!cfg) throw new Error(`Lane ${lane.id} is type=reddit-story but has no redditConfig`);

    const overrideUrl = process.env.VP_REDDIT_POST_URL?.trim();
    if (overrideUrl) {
      log(this.name, `Override URL provided: ${overrideUrl}`);
      const { post, comments } = await fetchPostByUrl(overrideUrl, context.profile.id);
      state.redditPost = post;
      state.redditComments = comments;
      log(this.name, `Fetched override post "${post.title}" with ${comments.length} comments`);
      return;
    }

    const subreddit = cfg.subreddit?.trim();
    if (!subreddit) {
      throw new Error(`Lane ${lane.id} redditConfig.subreddit is empty`);
    }

    const candidates = await fetchTopPosts(
      subreddit,
      { time: cfg.timeRange ?? "week", limit: 25 },
      context.profile.id,
    );
    if (candidates.length === 0) {
      throw new Error(`No reddit candidates fetched from r/${subreddit}`);
    }

    const usedIds = new Set(
      (context.topicHistory ?? [])
        .map((h) => h.redditPostId)
        .filter((id): id is string => Boolean(id)),
    );
    const fresh = candidates.filter((p) => !usedIds.has(p.id));
    if (fresh.length === 0) {
      log(this.name, "All candidate posts have been used; falling back to full set");
    }
    const pool = fresh.length > 0 ? fresh : candidates;
    log(this.name, `Choosing from ${pool.length} candidate posts`);

    const showDescription = cfg.showDescription === true;
    const targetSeconds = lane.targetDurationSeconds;
    const picked = await this.pickPost(pool, context, lane.description, {
      showDescription,
      targetSeconds,
    });
    log(
      this.name,
      `Picked: r/${picked.subreddit} "${picked.title}" (score ${picked.score}` +
        (showDescription ? `, body~${estimateBodySeconds(picked).toFixed(0)}s` : "") +
        `)`,
    );

    const { post, comments } = await fetchPostByUrl(picked.permalink, context.profile.id);
    state.redditPost = post;
    state.redditComments = comments;
    log(this.name, `Fetched ${comments.length} comments from "${post.title}"`);
  }

  private async pickPost(
    pool: RedditPost[],
    context: StageContext,
    laneDescription: string,
    opts: { showDescription: boolean; targetSeconds: number },
  ): Promise<RedditPost> {
    // Cap to top 20 by score so the prompt doesn't get too big.
    const ranked = [...pool].sort((a, b) => b.score - a.score).slice(0, 20);
    const list = ranked
      .map((p, i) => {
        const bodySec = opts.showDescription ? `, ~${estimateBodySeconds(p).toFixed(0)}s` : "";
        return `${i}. [r/${p.subreddit}] (score ${p.score}, ${p.numComments} comments${bodySec}) ${p.title}`;
      })
      .join("\n");

    const systemPrompt =
      SYSTEM_PROMPT_BASE +
      (opts.showDescription ? SYSTEM_PROMPT_DURATION_RULE : "") +
      RESPONSE_FORMAT;
    const userPrompt =
      `Lane description: ${laneDescription}\n` +
      (opts.showDescription
        ? `Lane target duration: ${opts.targetSeconds}s (post body is read aloud).\n\n`
        : `\n`) +
      `Candidates:\n${list}`;
    try {
      const result = await context.llm.generateJSON<{ chosenIndex: number; reason?: string }>(
        systemPrompt,
        userPrompt,
      );
      const idx = Math.max(0, Math.min(ranked.length - 1, Math.floor(result.chosenIndex ?? 0)));
      log(this.name, `LLM reason: ${result.reason ?? "(none)"}`);
      return ranked[idx];
    } catch (err) {
      log(this.name, `LLM pick failed (${(err as Error).message}); using top-scored post`);
      return ranked[0];
    }
  }
}
