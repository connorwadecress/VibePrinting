import type { ClipCandidate, ScoredCandidate } from "../domain/models.js";

export interface ScoringContext {
  keywords: string[];
  targetDuration: number;
  visualDescription: string;
}

const WEIGHT_KEYWORD = 0.4;
const WEIGHT_DURATION = 0.35;
const WEIGHT_PORTRAIT = 0.25;

/**
 * Extract usable string tags from the Pexels `tags: unknown[]` field.
 * Handles any shape defensively — returns only lowercase strings.
 */
function extractTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.toLowerCase());
}

/**
 * Score keyword relevance: how many scene keywords appear in the clip's tags
 * or matched search query. Keywords earlier in the list (more specific) get a
 * higher boost when they match.
 */
function scoreKeywords(
  candidate: ClipCandidate,
  keywords: string[],
): number {
  if (keywords.length === 0) return 0;

  const tags = extractTags(candidate.video.tags);
  const matchedLower = candidate.matchedKeyword.toLowerCase();
  let score = 0;

  for (let i = 0; i < keywords.length; i++) {
    const kw = keywords[i].toLowerCase();
    const specificityBoost = 1 - i / (keywords.length * 2); // first keyword = 1.0, last ≈ 0.5

    // Check if keyword appears in clip tags
    const tagMatch = tags.some(
      (tag) => tag.includes(kw) || kw.includes(tag),
    );
    if (tagMatch) {
      score += specificityBoost;
      continue;
    }

    // Check if keyword matches the search query that found this clip
    if (matchedLower.includes(kw) || kw.includes(matchedLower)) {
      score += specificityBoost * 0.7;
    }
  }

  return Math.min(1, score / keywords.length);
}

/**
 * Score duration closeness with asymmetric penalties.
 * Clips too short (will loop) are penalized more than clips slightly too long (will trim).
 */
function scoreDuration(clipDuration: number, targetDuration: number): number {
  if (targetDuration <= 0) return 0.5;
  const ratio = clipDuration / targetDuration;

  // Sweet spot: clip is 0.8x to 1.5x the target
  if (ratio >= 0.8 && ratio <= 1.5) {
    return 1 - Math.abs(1 - ratio) * 0.5;
  }

  // Too short → will loop — heavy penalty
  if (ratio < 0.8) {
    return Math.max(0, ratio * 0.5);
  }

  // Too long → will trim — moderate penalty
  return Math.max(0, 1 - (ratio - 1.5) * 0.3);
}

/**
 * Score portrait orientation (height > width = 1.0, landscape = 0.0).
 */
function scoreOrientation(width: number, height: number): number {
  return height > width ? 1.0 : 0.0;
}

/**
 * Compute a composite relevance score for a clip candidate.
 */
export function scoreCandidate(
  candidate: ClipCandidate,
  context: ScoringContext,
): ScoredCandidate {
  const kw = scoreKeywords(candidate, context.keywords);
  const dur = scoreDuration(candidate.video.duration, context.targetDuration);
  const orient = scoreOrientation(
    candidate.file.width ?? candidate.video.width,
    candidate.file.height ?? candidate.video.height,
  );

  const score = kw * WEIGHT_KEYWORD + dur * WEIGHT_DURATION + orient * WEIGHT_PORTRAIT;

  return { ...candidate, score };
}
