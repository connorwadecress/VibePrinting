import type { TikTokPage, TikTokToken } from "@remotion/captions";
import type { WordTiming } from "../domain/models.js";

export type { TikTokPage, TikTokToken } from "@remotion/captions";

const SENTENCE_END = /[.!?;]$/;
const CLAUSE_BREAK = /[,:\u2014\u2013\u2026]$/;  // comma, colon, em-dash, en-dash, ellipsis

function buildPage(tokens: TikTokToken[]): TikTokPage {
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  return {
    text: tokens.map((t) => t.text).join(" "),
    startMs: first.fromMs,
    tokens,
    durationMs: last.toMs - first.fromMs,
  };
}

/**
 * Segments word timings into caption pages that break on:
 * 1. Sentence-ending punctuation (. ! ? ;)
 * 2. Clause-separating punctuation (, : — …)
 * 3. Max words per page (for long clauses with no punctuation)
 */
export function wordTimingsToPages(
  wordTimings: WordTiming[],
  maxWordsPerPage = 5,
): TikTokPage[] {
  if (wordTimings.length === 0) return [];

  const tokens: TikTokToken[] = wordTimings.map((w) => ({
    text: w.text,
    fromMs: w.startMs,
    toMs: w.endMs,
  }));

  const pages: TikTokPage[] = [];
  let current: TikTokToken[] = [];

  for (const token of tokens) {
    current.push(token);

    const isSentenceEnd = SENTENCE_END.test(token.text);
    const isClauseBreak = CLAUSE_BREAK.test(token.text);
    const atMaxWords = current.length >= maxWordsPerPage;

    if (isSentenceEnd || isClauseBreak || atMaxWords) {
      pages.push(buildPage(current));
      current = [];
    }
  }

  // Flush remaining words
  if (current.length > 0) {
    pages.push(buildPage(current));
  }

  return pages;
}
