import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState, RedditComment } from "../../domain/models.js";
import { log } from "../../utils/logger.js";

const SYSTEM_PROMPT = `You curate Reddit comments for short-form videos.
Given a list of pre-filtered comments, return the indexes (0-based) of the comments you want to feature, IN THE ORDER they should be read aloud.

Selection rules:
- Prefer comments that tell a self-contained story or land a clear punchline.
- Prefer comments that vary in tone — mix funny, surprising, heartfelt; avoid five copies of the same beat.
- Save the strongest payoff for last — the final comment should reward viewers who watched to the end.
- Reject comments that need outside context, contain slurs, or are unsafe for general audiences.

Respond with JSON: {"orderedIndexes": number[], "reason": string}`;

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
      `Filtered ${all.length} -> ${filtered.length} -> ${pool.length} candidates; selecting ${targetCount}`,
    );

    const selected = await this.pickAndOrder(pool, targetCount, context);
    state.redditComments = selected;
    log(
      this.name,
      `Selected ${selected.length} comments: ${selected.map((c) => `${c.author}(${c.score})`).join(", ")}`,
    );
  }

  private async pickAndOrder(
    pool: RankedComment[],
    target: number,
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
      }>(SYSTEM_PROMPT, userPrompt);
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
