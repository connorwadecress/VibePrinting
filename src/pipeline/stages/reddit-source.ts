import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState, RedditPost } from "../../domain/models.js";
import { fetchPostByUrl, fetchTopPosts } from "../../utils/reddit-client.js";
import { log, logError } from "../../utils/logger.js";

const SYSTEM_PROMPT = `You pick AskReddit-style posts to turn into short-form videos.
Given a list of candidate posts, return the index (0-based) of the single best one.

Selection rules:
- Strongly prefer posts where the comments will be entertaining, surprising, or relatable.
- Strongly prefer posts that ask a personal-experience question (e.g. "what's the most awkward...", "what's a habit...").
- Avoid: politics, medical advice, anything sexual, anything involving real-name celebrities, anything tragic involving children.
- Higher score is a tiebreaker, not the primary signal.

Respond with JSON: {"chosenIndex": number, "reason": string}`;

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

    const subs = cfg.subreddits ?? [];
    if (subs.length === 0) {
      throw new Error(`Lane ${lane.id} redditConfig.subreddits is empty`);
    }

    const candidates: RedditPost[] = [];
    for (const sub of subs) {
      try {
        const top = await fetchTopPosts(
          sub,
          { time: cfg.timeRange ?? "week", limit: 25 },
          context.profile.id,
        );
        candidates.push(...top);
      } catch (err) {
        logError(this.name, `Failed to fetch r/${sub}: ${(err as Error).message}`);
      }
    }
    if (candidates.length === 0) {
      throw new Error("No reddit candidates fetched from any subreddit");
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

    const picked = await this.pickPost(pool, context, lane.description);
    log(this.name, `Picked: r/${picked.subreddit} "${picked.title}" (score ${picked.score})`);

    const { post, comments } = await fetchPostByUrl(picked.permalink, context.profile.id);
    state.redditPost = post;
    state.redditComments = comments;
    log(this.name, `Fetched ${comments.length} comments from "${post.title}"`);
  }

  private async pickPost(
    pool: RedditPost[],
    context: StageContext,
    laneDescription: string,
  ): Promise<RedditPost> {
    // Cap to top 20 by score so the prompt doesn't get too big.
    const ranked = [...pool].sort((a, b) => b.score - a.score).slice(0, 20);
    const list = ranked
      .map(
        (p, i) =>
          `${i}. [r/${p.subreddit}] (score ${p.score}, ${p.numComments} comments) ${p.title}`,
      )
      .join("\n");

    const userPrompt = `Lane description: ${laneDescription}\n\nCandidates:\n${list}`;
    try {
      const result = await context.llm.generateJSON<{ chosenIndex: number; reason?: string }>(
        SYSTEM_PROMPT,
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
