import type { RedditPost, RedditComment } from "../domain/models.js";
import { log } from "./logger.js";

const STAGE = "reddit";

export interface FetchTopOpts {
  time: "day" | "week" | "month" | "year" | "all";
  limit: number;
}

interface RawListing<T> {
  kind: string;
  data: { children: { kind: string; data: T }[] };
}

interface RawPost {
  id: string;
  subreddit: string;
  title: string;
  url: string;
  author: string;
  score: number;
  num_comments: number;
  permalink: string;
  selftext?: string;
  stickied?: boolean;
  over_18?: boolean;
  removed_by_category?: string | null;
  is_self?: boolean;
}

interface RawComment {
  id: string;
  author: string;
  body: string;
  score: number;
  depth: number;
  stickied?: boolean;
  distinguished?: string | null;
  body_html?: string;
}

const BLOCKED_AUTHORS = new Set([
  "AutoModerator",
  "[deleted]",
  "[removed]",
]);

const REMOVED_MARKERS = new Set([
  "[removed]",
  "[deleted]",
  "[ Removed by Reddit ]",
  "",
]);

function userAgent(brandHint?: string): string {
  const tag = brandHint ? brandHint.replace(/[^a-zA-Z0-9_-]/g, "") : "default";
  return `vibeprinting/0.1 (brand=${tag})`;
}

async function fetchJson<T>(url: string, brandHint?: string): Promise<T> {
  const headers: Record<string, string> = {
    "User-Agent": userAgent(brandHint),
    Accept: "application/json",
  };

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers });
    if (res.ok) {
      return (await res.json()) as T;
    }
    if (res.status === 429) {
      const wait = 1000 * Math.pow(2, attempt);
      log(STAGE, `429 from Reddit, backing off ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    lastErr = new Error(`reddit ${url} -> ${res.status} ${res.statusText}`);
    break;
  }
  throw lastErr ?? new Error(`reddit ${url} failed after retries`);
}

function decodeEntities(s: string): string {
  // Reddit's JSON returns titles and bodies HTML-encoded once
  // (&amp; for &, &lt; for <, &#39; for ', etc). Decode so TTS reads
  // them naturally and cards render the actual character.
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&hellip;/g, "…")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–");
}

function rawToPost(raw: RawPost): RedditPost {
  const rawSelftext = typeof raw.selftext === "string" ? raw.selftext.trim() : "";
  const cleanedSelftext = REMOVED_MARKERS.has(rawSelftext)
    ? ""
    : cleanRedditBody(rawSelftext);
  return {
    id: raw.id,
    subreddit: raw.subreddit,
    title: decodeEntities(raw.title),
    url: raw.url,
    author: raw.author,
    score: raw.score,
    numComments: raw.num_comments,
    permalink: raw.permalink,
    fetchedAt: new Date().toISOString(),
    selftext: cleanedSelftext || undefined,
  };
}

function cleanRedditBody(body: string): string {
  // Strip Reddit markdown links [text](url) -> text
  let out = decodeEntities(body);
  out = out.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Strip bare URLs
  out = out.replace(/https?:\/\/\S+/g, "");
  // Strip Reddit user/sub mentions in a way that survives TTS
  out = out.replace(/\/?u\/[A-Za-z0-9_-]+/g, "someone");
  out = out.replace(/\/?r\/[A-Za-z0-9_-]+/g, "");
  // Collapse markdown emphasis markers
  out = out.replace(/[*_~`]+/g, "");
  // "Edit:" / "EDIT:" / "Update:" trailing notes — common in TIFU/AITA tails
  out = out.replace(/(^|\n)\s*(edit|update)[\s:].*$/gim, "");
  // Collapse whitespace (also flattens paragraph breaks — TTS reads continuously)
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

function rawToComment(raw: RawComment): RedditComment | null {
  if (!raw || typeof raw.body !== "string") return null;
  if (BLOCKED_AUTHORS.has(raw.author)) return null;
  if (raw.stickied || raw.distinguished === "moderator") return null;
  if (REMOVED_MARKERS.has(raw.body.trim())) return null;
  const body = cleanRedditBody(raw.body);
  if (!body) return null;
  return {
    id: raw.id,
    author: raw.author,
    body,
    score: raw.score,
    depth: raw.depth ?? 0,
  };
}

function flattenComments(listing: RawListing<RawComment> | undefined): RedditComment[] {
  const out: RedditComment[] = [];
  if (!listing?.data?.children) return out;
  for (const child of listing.data.children) {
    if (child.kind !== "t1") continue;
    const c = rawToComment(child.data);
    if (c) out.push(c);
  }
  return out;
}

/**
 * Fetches top posts from a subreddit. Filters out stickied posts, NSFW, and removed posts.
 */
export async function fetchTopPosts(
  subreddit: string,
  opts: FetchTopOpts,
  brandHint?: string,
): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/top.json?t=${opts.time}&limit=${opts.limit}`;
  const data = await fetchJson<RawListing<RawPost>>(url, brandHint);
  const out: RedditPost[] = [];
  for (const child of data.data.children) {
    if (child.kind !== "t3") continue;
    const p = child.data;
    if (p.stickied || p.over_18 || p.removed_by_category) continue;
    out.push(rawToPost(p));
  }
  return out;
}

/**
 * Fetches a single post + its top-level comments. The url may be an absolute reddit URL,
 * a /r/<sub>/comments/<id>/<slug>/ permalink, or a bare post id (rare).
 */
export async function fetchPostByUrl(
  postUrl: string,
  brandHint?: string,
): Promise<{ post: RedditPost; comments: RedditComment[] }> {
  let normalized = postUrl.trim();
  if (normalized.startsWith("/")) {
    normalized = `https://www.reddit.com${normalized}`;
  }
  if (!normalized.startsWith("http")) {
    // Treat as bare post id — fetch via /comments/<id>.json
    normalized = `https://www.reddit.com/comments/${normalized}`;
  }
  // Ensure it ends in .json
  const apiUrl = normalized.replace(/\/?$/, "") + ".json?limit=200&depth=1";

  const raw = await fetchJson<[RawListing<RawPost>, RawListing<RawComment>]>(apiUrl, brandHint);
  if (!Array.isArray(raw) || raw.length < 2) {
    throw new Error(`Unexpected reddit response shape for ${apiUrl}`);
  }
  const postChild = raw[0]?.data?.children?.[0];
  if (!postChild || postChild.kind !== "t3") {
    throw new Error(`No post found at ${apiUrl}`);
  }
  const post = rawToPost(postChild.data);
  const comments = flattenComments(raw[1]);
  return { post, comments };
}
