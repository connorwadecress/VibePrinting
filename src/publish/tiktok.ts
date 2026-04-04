/**
 * TikTok Content Posting API integration.
 *
 * API reference: https://developers.tiktok.com/doc/content-posting-api-get-started
 *
 * Flow:
 *   1. Exchange refresh token for a short-lived access token
 *   2. Initialize the video upload (get upload_url + publish_id)
 *   3. PUT the mp4 bytes to the upload_url
 *   4. Poll /post/publish/status/fetch/ until status is PUBLISH_COMPLETE
 *
 * One-time setup to obtain a refresh token:
 *   Run the OAuth helper: `npx tsx src/publish/tiktok-auth.ts`
 *   See TikTok Developer Portal docs or the comment block in tiktok-auth.ts.
 */

import { createReadStream, statSync } from "fs";
import type { AppConfig } from "../config.js";
import type { PublishPackage } from "../domain/models.js";

const OPEN_API_BASE = "https://open.tiktokapis.com";

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  scope: string;
  token_type: string;
}

export async function refreshAccessToken(
  clientKey: string,
  clientSecret: string,
  refreshToken: string
): Promise<TokenResponse> {
  const res = await fetch(`${OPEN_API_BASE}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TikTok token refresh failed ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { data: TokenResponse };
  return data.data;
}

// ---------------------------------------------------------------------------
// Upload init
// ---------------------------------------------------------------------------

interface InitUploadResponse {
  publish_id: string;
  upload_url: string;
}

async function initVideoUpload(
  accessToken: string,
  pkg: PublishPackage,
  videoSizeBytes: number
): Promise<InitUploadResponse> {
  const body = {
    post_info: {
      title: pkg.title.slice(0, 2200),
      description: pkg.description.slice(0, 2200),
      privacy_level: "PUBLIC_TO_EVERYONE",
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
      video_cover_timestamp_ms: 1000,
      brand_content_toggle: pkg.disclosureRequired,
      brand_organic_toggle: false
    },
    source_info: {
      source: "FILE_UPLOAD",
      video_size: videoSizeBytes,
      chunk_size: videoSizeBytes,
      total_chunk_count: 1
    }
  };

  const res = await fetch(`${OPEN_API_BASE}/v2/post/publish/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TikTok upload init failed ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { data: InitUploadResponse };
  return json.data;
}

// ---------------------------------------------------------------------------
// Chunk upload (single-chunk for files ≤ 64 MB; extend for larger files)
// ---------------------------------------------------------------------------

async function uploadVideoFile(
  uploadUrl: string,
  videoPath: string,
  videoSizeBytes: number
): Promise<void> {
  const stream = createReadStream(videoPath);

  // Node 18+ fetch accepts a ReadableStream; cast to satisfy TS
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(videoSizeBytes),
      "Content-Range": `bytes 0-${videoSizeBytes - 1}/${videoSizeBytes}`
    },
    body: stream as unknown as BodyInit,
    // @ts-expect-error -- Node fetch needs duplex for streaming
    duplex: "half"
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TikTok video upload failed ${res.status}: ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Status polling
// ---------------------------------------------------------------------------

type PublishStatus =
  | "PROCESSING_UPLOAD"
  | "PROCESSING_DOWNLOAD"
  | "SEND_TO_USER_INBOX"
  | "FAILED"
  | "PUBLISH_COMPLETE";

interface StatusResponse {
  publish_id: string;
  status: PublishStatus;
  fail_reason?: string;
}

async function pollPublishStatus(
  accessToken: string,
  publishId: string,
  maxWaitMs = 120_000
): Promise<StatusResponse> {
  const interval = 4_000;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const res = await fetch(`${OPEN_API_BASE}/v2/post/publish/status/fetch/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8"
      },
      body: JSON.stringify({ publish_id: publishId })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`TikTok status fetch failed ${res.status}: ${text}`);
    }

    const json = (await res.json()) as { data: StatusResponse };
    const status = json.data;

    if (status.status === "PUBLISH_COMPLETE") return status;
    if (status.status === "FAILED") {
      throw new Error(
        `TikTok publish failed: ${status.fail_reason ?? "unknown reason"}`
      );
    }

    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(`TikTok publish timed out after ${maxWaitMs / 1000}s`);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface TikTokPublishResult {
  publishId: string;
  status: string;
}

/**
 * Upload a local mp4 file to TikTok and wait for it to be published.
 *
 * @param videoPath  Absolute path to the final.mp4
 * @param pkg        PublishPackage from the pipeline
 * @param config     Loaded AppConfig (must have tikTok* fields set)
 */
export async function publishToTikTok(
  videoPath: string,
  pkg: PublishPackage,
  config: AppConfig
): Promise<TikTokPublishResult> {
  const { tikTokClientKey, tikTokClientSecret, tikTokRefreshToken } = config;

  if (!tikTokClientKey || !tikTokClientSecret || !tikTokRefreshToken) {
    throw new Error(
      "TikTok credentials missing. Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, and TIKTOK_REFRESH_TOKEN."
    );
  }

  const { access_token } = await refreshAccessToken(
    tikTokClientKey,
    tikTokClientSecret,
    tikTokRefreshToken
  );

  const videoSizeBytes = statSync(videoPath).size;
  const { publish_id, upload_url } = await initVideoUpload(
    access_token,
    pkg,
    videoSizeBytes
  );

  await uploadVideoFile(upload_url, videoPath, videoSizeBytes);

  const result = await pollPublishStatus(access_token, publish_id);

  return { publishId: result.publish_id, status: result.status };
}
