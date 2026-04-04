import fs from "node:fs";
import type { AppConfig } from "../../config.js";
import type { ShortScript, TikTokUploadResult } from "../../domain/models.js";
import { log, logError } from "../../utils/logger.js";

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

// Max chunk size for TikTok chunked upload (10 MB)
const MAX_CHUNK_SIZE = 10 * 1024 * 1024;

// Poll interval and max attempts for publish status
const STATUS_POLL_INTERVAL_MS = 5_000;
const STATUS_POLL_MAX_ATTEMPTS = 36; // 3 minutes total

/**
 * Upload mode:
 *   "draft"  — uses /post/publish/inbox/video/init/ (video.upload scope)
 *              Video lands in the creator's TikTok inbox as a draft to review and post.
 *              This is the default mode — matches "Upload to TikTok" in the Developer Portal.
 *
 *   "direct" — uses /post/publish/video/init/ (video.publish scope + Direct Post enabled)
 *              Video posts immediately to the creator's profile.
 *              Requires Direct Post to be toggled ON in the Developer Portal and app review approval.
 *
 * Current portal config: Draft mode (Direct Post = OFF, scope = video.upload).
 */
const UPLOAD_MODE: "draft" | "direct" = "direct";

/**
 * Refreshes the TikTok access token using the stored refresh token.
 * Returns the new access token (and logs a reminder to persist the new refresh token).
 */
async function refreshAccessToken(config: AppConfig): Promise<string> {
  if (!config.tikTokClientKey || !config.tikTokClientSecret || !config.tikTokRefreshToken) {
    throw new Error(
      "Missing TikTok credentials. Ensure TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, and TIKTOK_REFRESH_TOKEN are set in .env"
    );
  }

  const response = await fetch(`${TIKTOK_API_BASE}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: config.tikTokClientKey,
      client_secret: config.tikTokClientSecret,
      grant_type: "refresh_token",
      refresh_token: config.tikTokRefreshToken,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TikTok token refresh failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  log("tiktok", `Token refreshed (expires in ${data.expires_in}s)`);
  log("tiktok", "NOTE: Update TIKTOK_REFRESH_TOKEN in .env if the refresh token has rotated.");

  return data.access_token;
}

/**
 * Resolves a valid access token — uses the stored one if available,
 * otherwise refreshes via the refresh token flow.
 */
async function resolveAccessToken(config: AppConfig): Promise<string> {
  if (config.tikTokAccessToken) {
    return config.tikTokAccessToken;
  }
  return refreshAccessToken(config);
}

/**
 * Builds a short description string from the script for logging purposes.
 * Not sent in draft mode (no post_info needed for inbox uploads).
 */
function buildTikTokTitle(script: ShortScript): string {
  const hashtags = "#SignalDrop #Shorts #LearnOnTikTok #FYP";
  const maxTitleLen = 150 - hashtags.length - 2; // 2 for "\n\n"

  let rawTitle = script.hook.replace(/[<>]/g, "").trim();
  if (rawTitle.length > maxTitleLen) {
    rawTitle = rawTitle.substring(0, maxTitleLen - 3) + "...";
  }

  return `${rawTitle}\n\n${hashtags}`;
}

/**
 * Initialises a DRAFT upload (inbox) on TikTok.
 * Video lands in the creator's TikTok inbox for review before posting.
 * Uses the video.upload scope — no Direct Post approval required.
 */
async function initDraftUpload(
  accessToken: string,
  fileSize: number,
  chunkCount: number
): Promise<{ uploadUrl: string; publishId: string }> {
  const response = await fetch(`${TIKTOK_API_BASE}/post/publish/inbox/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      source_info: {
        source: "FILE_UPLOAD",
        video_size: fileSize,
        chunk_size: Math.min(fileSize, MAX_CHUNK_SIZE),
        total_chunk_count: chunkCount,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TikTok draft init failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    data: { upload_url: string; publish_id: string };
    error: { code: string; message: string };
  };

  if (data.error?.code !== "ok") {
    throw new Error(`TikTok draft init error: ${data.error.code} — ${data.error.message}`);
  }

  return {
    uploadUrl: data.data.upload_url,
    publishId: data.data.publish_id,
  };
}

/**
 * Initialises a DIRECT POST upload on TikTok.
 * Video is published immediately to the creator's profile.
 * Requires Direct Post enabled in Developer Portal + video.publish scope + app review approval.
 */
async function initDirectPost(
  accessToken: string,
  fileSize: number,
  chunkCount: number,
  title: string
): Promise<{ uploadUrl: string; publishId: string }> {
  const response = await fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title,
        privacy_level: "SELF_ONLY", // Change to PUBLIC_TO_EVERYONE after app review
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: fileSize,
        chunk_size: Math.min(fileSize, MAX_CHUNK_SIZE),
        total_chunk_count: chunkCount,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TikTok direct post init failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    data: { upload_url: string; publish_id: string };
    error: { code: string; message: string };
  };

  if (data.error?.code !== "ok") {
    throw new Error(`TikTok direct post init error: ${data.error.code} — ${data.error.message}`);
  }

  return {
    uploadUrl: data.data.upload_url,
    publishId: data.data.publish_id,
  };
}

/**
 * Uploads the video file in chunks to TikTok's upload URL.
 */
async function uploadChunks(uploadUrl: string, videoPath: string, fileSize: number): Promise<void> {
  const chunkCount = Math.ceil(fileSize / MAX_CHUNK_SIZE);

  for (let i = 0; i < chunkCount; i++) {
    const start = i * MAX_CHUNK_SIZE;
    const end = Math.min(start + MAX_CHUNK_SIZE, fileSize) - 1;
    const chunkSize = end - start + 1;

    const fileHandle = fs.openSync(videoPath, "r");
    const buffer = Buffer.alloc(chunkSize);
    fs.readSync(fileHandle, buffer, 0, chunkSize, start);
    fs.closeSync(fileHandle);

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(chunkSize),
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      },
      body: buffer,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`TikTok chunk upload failed (chunk ${i + 1}/${chunkCount}, ${response.status}): ${text}`);
    }

    const pct = Math.round(((i + 1) / chunkCount) * 100);
    process.stdout.write(`\r  TikTok uploading... ${pct}%`);
  }

  process.stdout.write("\n");
}

/**
 * Polls the publish status endpoint until the video finishes processing.
 * Works for both draft (inbox) and direct post uploads.
 */
async function pollPublishStatus(
  accessToken: string,
  publishId: string
): Promise<"PUBLISH_COMPLETE" | "FAILED"> {
  for (let attempt = 0; attempt < STATUS_POLL_MAX_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_INTERVAL_MS));

    const response = await fetch(`${TIKTOK_API_BASE}/post/publish/status/fetch/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ publish_id: publishId }),
    });

    if (!response.ok) {
      log("tiktok", `Status poll failed (${response.status}), retrying...`);
      continue;
    }

    const data = (await response.json()) as {
      data: { status: string; publicaly_available_post_id?: string[] };
      error: { code: string; message: string };
    };

    const status = data.data?.status;
    log("tiktok", `Upload status: ${status ?? "unknown"}`);

    if (status === "PUBLISH_COMPLETE") {
      return "PUBLISH_COMPLETE";
    }

    if (status === "FAILED") {
      logError("tiktok", `Upload failed: ${data.error?.message ?? "unknown error"}`);
      return "FAILED";
    }

    // PROCESSING_UPLOAD or PROCESSING_DOWNLOAD — keep polling
  }

  logError("tiktok", "Upload status polling timed out after 3 minutes.");
  return "FAILED";
}

/**
 * Uploads the final MP4 to TikTok via the Content Posting API.
 *
 * Current mode: DRAFT (inbox) — video lands in the creator's TikTok inbox as a draft.
 * The creator reviews and publishes manually from the TikTok app or studio.
 * This matches the Developer Portal config (Direct Post = OFF, scope = video.upload).
 *
 * To switch to Direct Post (auto-publish):
 *   1. Enable Direct Post toggle in Developer Portal → Content Posting API
 *   2. Add video.publish scope (remove video.upload)
 *   3. Re-run Get-TikTokToken.ps1 to get a new token with the updated scope
 *   4. Change UPLOAD_MODE constant at the top of this file from "draft" to "direct"
 *
 * Flow (draft mode):
 *  1. Resolve access token (use stored or refresh)
 *  2. Init inbox upload → get upload URL + publish ID
 *  3. Upload file in chunks
 *  4. Poll status until PUBLISH_COMPLETE (= successfully landed in creator inbox)
 */
export async function uploadToTikTok(
  videoPath: string,
  script: ShortScript,
  config: AppConfig
): Promise<TikTokUploadResult> {
  log("tiktok", `Starting upload to TikTok (mode: ${UPLOAD_MODE})...`);

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const accessToken = await resolveAccessToken(config);
  const fileSize = fs.statSync(videoPath).size;
  const chunkCount = Math.ceil(fileSize / MAX_CHUNK_SIZE);
  const title = buildTikTokTitle(script);

  log("tiktok", `Title: ${title.split("\n")[0]}`);
  log("tiktok", `File size: ${(fileSize / 1024 / 1024).toFixed(1)} MB (${chunkCount} chunk(s))`);

  // Step 1: Init the upload (draft or direct depending on mode)
  const { uploadUrl, publishId } =
    UPLOAD_MODE === "draft"
      ? await initDraftUpload(accessToken, fileSize, chunkCount)
      : await initDirectPost(accessToken, fileSize, chunkCount, title);

  log("tiktok", `Publish ID: ${publishId}`);

  // Step 2: Upload chunks
  await uploadChunks(uploadUrl, videoPath, fileSize);

  // Step 3: Poll until processing is complete
  const status = await pollPublishStatus(accessToken, publishId);

  if (status === "FAILED") {
    throw new Error("TikTok upload failed. Check TikTok Developer Portal for details.");
  }

  const modeNote =
    UPLOAD_MODE === "draft"
      ? "Video is now in your TikTok creator inbox as a draft — review and publish from the TikTok app."
      : "Video posted directly to your TikTok profile.";

  log("tiktok", "Upload complete!");
  log("tiktok", modeNote);
  log("tiktok", `Publish ID: ${publishId}`);

  // TikTok doesn't return a direct video URL from the API.
  // For drafts, the video is in the TikTok creator inbox (no shareable URL until published).
  const videoUrl =
    UPLOAD_MODE === "draft"
      ? "https://www.tiktok.com/creator#inbox" // Creator inbox where draft will appear
      : `https://www.tiktok.com/@signaldrop/video/${publishId}`;

  return { publishId, videoUrl, title: title.split("\n")[0] };
}
