import fs from "node:fs";
import type { AppConfig } from "../../config.js";
import type { Uploader, UploadMetadata, UploadResult } from "../../domain/interfaces/uploader.js";
import { log, logError } from "../../utils/logger.js";

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";
const MAX_CHUNK_SIZE = 64 * 1024 * 1024;
const STATUS_POLL_INTERVAL_MS = 5_000;
const STATUS_POLL_MAX_ATTEMPTS = 36; // 3 minutes total

/**
 * Upload mode:
 *   "draft"  — video lands in creator's TikTok inbox as a draft
 *   "direct" — video posts immediately to creator's profile
 */
const UPLOAD_MODE: "draft" | "direct" = "draft";

export class TikTokUploader implements Uploader {
  readonly platform = "tiktok";

  constructor(private readonly config: AppConfig) {}

  isConfigured(): boolean {
    return !!(
      this.config.tikTokClientKey &&
      this.config.tikTokClientSecret &&
      (this.config.tikTokAccessToken || this.config.tikTokRefreshToken)
    );
  }

  async upload(videoPath: string, metadata: UploadMetadata): Promise<UploadResult> {
    log("tiktok", `Starting upload (mode: ${UPLOAD_MODE})...`);

    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    const accessToken = await this.resolveAccessToken();
    const fileSize = fs.statSync(videoPath).size;
    const chunkCount = Math.ceil(fileSize / MAX_CHUNK_SIZE);

    const title = this.buildTitle(metadata);
    log("tiktok", `Title: ${title.split("\n")[0]}`);
    log("tiktok", `File size: ${(fileSize / 1024 / 1024).toFixed(1)} MB (${chunkCount} chunk(s))`);

    const { uploadUrl, publishId } =
      UPLOAD_MODE === "draft"
        ? await this.initDraftUpload(accessToken, fileSize, chunkCount)
        : await this.initDirectPost(accessToken, fileSize, chunkCount, title);

    log("tiktok", `Publish ID: ${publishId}`);

    await this.uploadChunks(uploadUrl, videoPath, fileSize);

    const status = await this.pollPublishStatus(accessToken, publishId);
    if (status === "FAILED") {
      throw new Error("TikTok upload failed. Check TikTok Developer Portal for details.");
    }

    const modeNote =
      UPLOAD_MODE === "draft"
        ? "Video is now in your TikTok creator inbox as a draft."
        : "Video posted directly to your TikTok profile.";

    log("tiktok", "Upload complete!");
    log("tiktok", modeNote);

    const videoUrl =
      UPLOAD_MODE === "draft"
        ? "https://www.tiktok.com/creator#inbox"
        : `https://www.tiktok.com/@user/video/${publishId}`;

    return { platform: this.platform, id: publishId, url: videoUrl, title: title.split("\n")[0] };
  }

  private buildTitle(metadata: UploadMetadata): string {
    const hashtagStr = metadata.hashtags.join(" ");
    const maxTitleLen = 150 - hashtagStr.length - 2;

    let rawTitle = metadata.title.replace(/[<>]/g, "").trim();
    if (rawTitle.length > maxTitleLen) {
      rawTitle = rawTitle.substring(0, maxTitleLen - 3) + "...";
    }

    return `${rawTitle}\n\n${hashtagStr}`;
  }

  private async resolveAccessToken(): Promise<string> {
    if (this.config.tikTokAccessToken) return this.config.tikTokAccessToken;
    return this.refreshAccessToken();
  }

  private async refreshAccessToken(): Promise<string> {
    if (!this.config.tikTokClientKey || !this.config.tikTokClientSecret || !this.config.tikTokRefreshToken) {
      throw new Error(
        "Missing TikTok credentials. Ensure TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, and TIKTOK_REFRESH_TOKEN are set in .env",
      );
    }

    const response = await fetch(`${TIKTOK_API_BASE}/oauth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: this.config.tikTokClientKey,
        client_secret: this.config.tikTokClientSecret,
        grant_type: "refresh_token",
        refresh_token: this.config.tikTokRefreshToken,
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
    return data.access_token;
  }

  private async initDraftUpload(
    accessToken: string,
    fileSize: number,
    chunkCount: number,
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

    return { uploadUrl: data.data.upload_url, publishId: data.data.publish_id };
  }

  private async initDirectPost(
    accessToken: string,
    fileSize: number,
    chunkCount: number,
    title: string,
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
          privacy_level: "SELF_ONLY",
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

    return { uploadUrl: data.data.upload_url, publishId: data.data.publish_id };
  }

  private async uploadChunks(uploadUrl: string, videoPath: string, fileSize: number): Promise<void> {
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

  private async pollPublishStatus(
    accessToken: string,
    publishId: string,
  ): Promise<"PUBLISH_COMPLETE" | "SEND_TO_USER_INBOX" | "FAILED"> {
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

      if (status === "PUBLISH_COMPLETE") return "PUBLISH_COMPLETE";
      if (status === "SEND_TO_USER_INBOX") return "SEND_TO_USER_INBOX";

      if (status === "FAILED") {
        logError("tiktok", `Upload failed: ${data.error?.message ?? "unknown error"}`);
        return "FAILED";
      }
    }

    logError("tiktok", "Upload status polling timed out after 3 minutes.");
    return "FAILED";
  }
}
