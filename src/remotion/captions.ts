import type { Caption } from "@remotion/captions";
import { createTikTokStyleCaptions } from "@remotion/captions";
import type { TikTokPage } from "@remotion/captions";
import type { WordTiming } from "../domain/models.js";

export type { TikTokPage, TikTokToken } from "@remotion/captions";

export function wordTimingsToPages(
  wordTimings: WordTiming[],
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

  return pages;
}
