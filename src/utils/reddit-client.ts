import { ProxyAgent, type Dispatcher } from "undici";
import type { RedditPost, RedditComment } from "../domain/models.js";
import { log } from "./logger.js";

const STAGE = "reddit";

let cachedDispatcher: Dispatcher | undefined;
let lastProxyUrl: string | undefined;

/**
 * Returns an undici ProxyAgent if REDDIT_HTTP_PROXY is set, else undefined.
 * Cached across calls; re-created if the env var changes (rare, but cheap).
 *
 * Hostinger and most other datacenter ASNs are 403'd by Reddit unauthenticated.
 * If app-only OAuth is also closed off (Reddit's new "Responsible Builder"
 * registration gate), routing through a residential proxy is the escape hatch.
 *
 * Supported via undici's ProxyAgent: http:// and https:// CONNECT proxies.
 * For SOCKS5 (e.g. ssh -D), front-end it with microsocks/gost on the home
 * machine and point REDDIT_HTTP_PROXY at the http bridge.
 */
function getProxyDispatcher(): Dispatcher | undefined {
  const proxy = process.env.REDDIT_HTTP_PROXY?.trim();
  if (!proxy) {
    cachedDispatcher = undefined;
    lastProxyUrl = undefined;
    return undefined;
  }
  if (!cachedDispatcher || lastProxyUrl !== proxy) {
    cachedDispatcher = new ProxyAgent(proxy);
    lastProxyUrl = proxy;
    log(STAGE, `Routing Reddit traffic through proxy ${proxy}`);
  }
  return cachedDispatcher;
}

type FetchInitWithDispatcher = RequestInit & { dispatcher?: Dispatcher };

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
  // Reddit's API rules ask for: <platform>:<app id>:<version> (by /u/<username>).
  // Anonymous requests from datacenter IPs (Hostinger, AWS, etc.) get 403'd
  // when the UA looks generic, so we let operators override with a real
  // Reddit-compliant string via REDDIT_USER_AGENT.
  const override = process.env.REDDIT_USER_AGENT?.trim();
  if (override) return override;
  const tag = brandHint ? brandHint.replace(/[^a-zA-Z0-9_-]/g, "") : "default";
  return `node:vibeprinting:0.1 (brand=${tag})`;
}

interface OAuthToken {
  accessToken: string;
  expiresAtMs: number;
}

let cachedToken: OAuthToken | null = null;

/**
 * Fetch (or reuse) an application-only OAuth token. Reddit calls this
 * "Application Only OAuth" — works for both web/script and installed app
 * types. Caches with a 60s safety margin so we don't fly off the cliff.
 *
 * Returns null when REDDIT_CLIENT_ID/SECRET aren't configured, signalling
 * the caller to fall back to anonymous www.reddit.com.
 */
async function getOAuthToken(brandHint?: string): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID?.trim();
  const clientSecret = process.env.REDDIT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs > now + 60_000) {
    return cachedToken.accessToken;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  const dispatcher = getProxyDispatcher();
  const tokenInit: FetchInitWithDispatcher = {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent(brandHint),
    },
    body,
  };
  if (dispatcher) tokenInit.dispatcher = dispatcher;
  const res = await fetch("https://www.reddit.com/api/v1/access_token", tokenInit);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`reddit oauth token request failed: ${res.status} ${res.statusText} ${text}`);
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new Error("reddit oauth response missing access_token");
  }
  const lifetimeMs = (json.expires_in ?? 3600) * 1000;
  cachedToken = {
    accessToken: json.access_token,
    expiresAtMs: now + lifetimeMs,
  };
  log(STAGE, `Acquired OAuth token (expires in ${Math.floor(lifetimeMs / 1000)}s)`);
  return cachedToken.accessToken;
}

/**
 * If OAuth is configured, swap www.reddit.com for oauth.reddit.com so the
 * bearer token is honored. Leaves any other host untouched.
 */
function rewriteHostForOAuth(url: string): string {
  return url
    .replace(/^https:\/\/www\.reddit\.com/, "https://oauth.reddit.com")
    .replace(/^https:\/\/old\.reddit\.com/, "https://oauth.reddit.com");
}

async function fetchJson<T>(url: string, brandHint?: string): Promise<T> {
  const token = await getOAuthToken(brandHint);
  const finalUrl = token ? rewriteHostForOAuth(url) : url;
  const headers: Record<string, string> = {
    "User-Agent": userAgent(brandHint),
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const dispatcher = getProxyDispatcher();

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const init: FetchInitWithDispatcher = { headers };
    if (dispatcher) init.dispatcher = dispatcher;
    const res = await fetch(finalUrl, init);
    if (res.ok) {
      return (await res.json()) as T;
    }
    if (res.status === 429) {
      const wait = 1000 * Math.pow(2, attempt);
      log(STAGE, `429 from Reddit, backing off ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (res.status === 401 && token) {
      // Token might have been revoked or rotated mid-flight; bust cache and retry once.
      log(STAGE, "401 from Reddit OAuth — refreshing token");
      cachedToken = null;
      continue;
    }
    if (res.status === 403 && !token) {
      lastErr = new Error(
        `reddit ${finalUrl} -> 403 (likely datacenter-IP block). ` +
          `Set REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET (and optionally REDDIT_USER_AGENT) to use authenticated access.`,
      );
      break;
    }
    lastErr = new Error(`reddit ${finalUrl} -> ${res.status} ${res.statusText}`);
    break;
  }
  throw lastErr ?? new Error(`reddit ${finalUrl} failed after retries`);
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
