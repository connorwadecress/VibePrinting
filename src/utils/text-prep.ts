import type { WordTiming } from "../domain/models.js";

/**
 * Strip characters that the TTS engine reads aloud as words (e.g. "/" as
 * "slash", "(" as "parenthesis") while keeping the meaning. Apply this
 * before sending text to the TTS provider; pair with alignTimingsToOriginal
 * so the on-screen captions still get the original grammar.
 */
export function prepareTextForTts(text: string): string {
  let out = text;
  // "and/or" → "and or" — TTS otherwise vocalizes "/" as "slash".
  out = out.replace(/\//g, " ");
  // Drop bracket pairs but keep their contents — "(laughing)" → "laughing".
  out = out.replace(/[()[\]{}]/g, "");
  // Strip residual markdown emphasis if any survived upstream cleaning.
  out = out.replace(/[*_~`]+/g, "");
  // Normalize curly quotes to straight so TTS treats them consistently.
  out = out.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  // Collapse repeated whitespace.
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

/**
 * Re-attach the original-text grammar (parens, quotes, slashes, punctuation)
 * to TTS-derived word timings so on-screen captions show natural text
 * instead of the alphanumeric-only stream the TTS providers return.
 *
 * Strategy: split the original text on whitespace into "display tokens"
 * (e.g. `"hello,"`, `(laughing)`, `she/he`). For each TTS word timing,
 * advance through display tokens until one with a matching alphanumeric
 * core is found, then replace the timing's text with the display token.
 *
 * If the alignment falls out of sync (e.g. TTS split "AskReddit" into
 * "Ask Reddit"), the timing keeps its original text. Imperfect but never
 * worse than the current "no punctuation at all" baseline.
 */
export function alignTimingsToOriginal(
  timings: WordTiming[],
  originalText: string,
): WordTiming[] {
  if (timings.length === 0) return timings;
  const displayTokens = originalText.trim().split(/\s+/).filter(Boolean);
  if (displayTokens.length === 0) return timings;

  const result: WordTiming[] = [];
  let dIdx = 0;

  for (const t of timings) {
    const tCore = alphanumericCore(t.text);
    if (!tCore) {
      result.push(t);
      continue;
    }
    let matched = false;
    while (dIdx < displayTokens.length) {
      const dTok = displayTokens[dIdx];
      const dCore = alphanumericCore(dTok);
      if (dCore.length === 0) {
        // Pure-symbol token in the original (rare) — skip.
        dIdx++;
        continue;
      }
      if (dCore === tCore) {
        result.push({ ...t, text: dTok });
        dIdx++;
        matched = true;
        break;
      }
      // Mismatch: TTS may have split a hyphenated/compound word. Bail
      // for this timing — keep its raw text — and try the same display
      // token against the next timing.
      break;
    }
    if (!matched) result.push(t);
  }
  return result;
}

function alphanumericCore(s: string): string {
  return s.replace(/[^a-zA-Z0-9']/g, "").toLowerCase();
}
