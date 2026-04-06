import type { Caption } from "@remotion/captions";
import { createTikTokStyleCaptions } from "@remotion/captions";
import type { TikTokPage, TikTokToken } from "@remotion/captions";
import type { WordTiming } from "../domain/models.js";

export type { TikTokPage, TikTokToken } from "@remotion/captions";

function splitLargePages(pages: TikTokPage[], maxWordsPerPage: number): TikTokPage[] {
  const result: TikTokPage[] = [];

  for (const page of pages) {
    if (page.tokens.length <= maxWordsPerPage) {
      result.push(page);
      continue;
    }

    for (let i = 0; i < page.tokens.length; i += maxWordsPerPage) {
      const chunk = page.tokens.slice(i, i + maxWordsPerPage);
      const firstToken = chunk[0];
      const lastToken = chunk[chunk.length - 1];
      result.push({
        text: chunk.map((t) => t.text).join(" "),
        startMs: firstToken.fromMs,
        tokens: chunk,
        durationMs: lastToken.toMs - firstToken.fromMs,
      });
    }
  }

  return result;
}

export function wordTimingsToPages(
  wordTimings: WordTiming[],
  maxWordsPerPage = 4,
  combineWithinMs = 1200,
): TikTokPage[] {
  const captions: Caption[] = wordTimings.map((w) => ({
    text: w.text,
    startMs: w.startMs,
    endMs: w.endMs,
    timestampMs: w.startMs,
    confidence: 1,
  }));

  const { pages } = createTikTokStyleCaptions({
    captions,
    combineTokensWithinMilliseconds: combineWithinMs,
  });

  return splitLargePages(pages, maxWordsPerPage);
}
