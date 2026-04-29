import type { CommentTone, SubredditConfig } from "../domain/models.js";

export function findSubredditConfig(
  subs: SubredditConfig[],
  name: string,
): SubredditConfig | undefined {
  const lower = name.toLowerCase();
  return subs.find((s) => s.name.toLowerCase() === lower);
}

export function resolveCommentTone(
  sub: SubredditConfig | undefined,
  laneDefault: CommentTone | undefined,
): CommentTone {
  return sub?.commentTone ?? laneDefault ?? "blend";
}
