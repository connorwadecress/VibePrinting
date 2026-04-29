import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { CommentTone, PipelineState, RedditComment } from "../../domain/models.js";
import { log } from "../../utils/logger.js";
import { findSubredditConfig, resolveCommentTone } from "../../utils/reddit-config.js";

const BASE_RULES = `You curate Reddit comments for short-form videos.
Given a list of pre-filtered comments, return the indexes (0-based) of the comments you want to feature, IN THE ORDER they should be read aloud.

Selection rules:
- Prefer comments that tell a self-contained story or land a clear punchline.
- Save the strongest payoff for last — the final comment should reward viewers who watched to the end.
- Reject comments that need outside context, contain slurs, or are unsafe for general audiences.`;

const TONE_RULES: Record<CommentTone, string> = {
  funny: `Tone for THIS subreddit: FUNNY.
- Strongly favor comments that are funny, absurd, self-deprecating, or land a clear punchline.
- Skip earnest reflections, life lessons, and heartfelt confessions unless they double as the joke.`,
  sincere: `Tone for THIS subreddit: SINCERE.
- Strongly favor comments that are heartfelt, insightful, or quietly devastating.
- Skip pure jokes and sarcasm unless they carry real emotional weight.`,
  blend: `Tone for THIS subreddit: BLEND.
- Vary the tone across the selection — mix funny, surprising, and heartfelt.
- Avoid five copies of the same beat in a row.`,
};

function buildSystemPrompt(tone: CommentTone): string {
  return `${BASE_RULES}\n\n${TONE_RULES[tone]}\n\nRespond with JSON: {"orderedIndexes": number[], "reason": string}`;
}

const URL_RE = /https?:\/\//i;

interface RankedComment extends RedditComment {
  bodyLength: number;
}

export class CommentSelectionStage implements PipelineStage {
  readonly name = "comment-selection";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    const lane = state.lane;
    if (!lane) throw new Error("No lane in pipeline state");
    const cfg = lane.redditConfig;
    const minLen = cfg?.minCommentLength ?? 80;
    const maxLen = cfg?.maxCommentLength ?? 600;
    const targetCount = cfg?.commentCount ?? 5;

    const all = state.redditComments ?? [];
    if (all.length === 0) throw new Error("No reddit comments in pipeline state");

    const post = state.redditPost;
    const subCfg = post
      ? findSubredditConfig(cfg?.subreddits ?? [], post.subreddit)
      : undefined;
    const tone = resolveCommentTone(subCfg, cfg?.commentTone);

    const filtered: RankedComment[] = all
      .filter((c) => c.depth === 0)
      .filter((c) => c.body.length >= minLen && c.body.length <= maxLen)
      .filter((c) => !URL_RE.test(c.body))
      .map((c) => ({ ...c, bodyLength: c.body.length }))
      .sort((a, b) => b.score - a.score);

    if (filtered.length === 0) {
      throw new Error(
        `No comments matched filters (min=${minLen}, max=${maxLen}, top-level only). ` +
          `Got ${all.length} raw comments.`,
      );
    }

    // Cap to a generous candidate pool, then ask the LLM to pick + order.
    const pool = filtered.slice(0, Math.max(targetCount * 3, 12));
    log(
      this.name,
      `Filtered ${all.length} -> ${filtered.length} -> ${pool.length} candidates; selecting ${targetCount} (tone=${tone})`,
    );

    const selected = await this.pickAndOrder(pool, targetCount, tone, context);
    state.redditComments = selected;
    log(
      this.name,
      `Selected ${selected.length} comments: ${selected.map((c) => `${c.author}(${c.score})`).join(", ")}`,
    );
  }

  private async pickAndOrder(
    pool: RankedComment[],
    target: number,
    tone: CommentTone,
    context: StageContext,
  ): Promise<RedditComment[]> {
    const list = pool
      .map((c, i) => `${i}. [u/${c.author}, score ${c.score}, ${c.bodyLength} chars] ${c.body}`)
      .join("\n\n");
    const userPrompt = `Pick the top ${target} comments and order them best-last.\n\nCandidates:\n\n${list}`;
    try {
      const result = await context.llm.generateJSON<{
        orderedIndexes: number[];
        reason?: string;
      }>(buildSystemPrompt(tone), userPrompt);
      const seen = new Set<number>();
      const out: RedditComment[] = [];
      for (const raw of result.orderedIndexes ?? []) {
        const idx = Math.floor(raw);
        if (Number.isFinite(idx) && idx >= 0 && idx < pool.length && !seen.has(idx)) {
          seen.add(idx);
          out.push(pool[idx]);
          if (out.length >= target) break;
        }
      }
      log(this.name, `LLM reason: ${result.reason ?? "(none)"}`);
      if (out.length === 0) throw new Error("LLM returned no usable indexes");
      return out;
    } catch (err) {
      log(this.name, `LLM ranking failed (${(err as Error).message}); falling back to top-N by score`);
      return pool.slice(0, target);
    }
  }
}
