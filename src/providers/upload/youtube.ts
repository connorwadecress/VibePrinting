import { google } from "googleapis";
import fs from "node:fs";
import type { AppConfig } from "../../config.js";
import type { Uploader, UploadMetadata, UploadResult } from "../../domain/interfaces/uploader.js";
import { log } from "../../utils/logger.js";

export class YouTubeUploader implements Uploader {
  readonly platform = "youtube";

  constructor(private readonly config: AppConfig) {}

  isConfigured(): boolean {
    return !!(
      this.config.youTubeClientId &&
      this.config.youTubeClientSecret &&
      this.config.youTubeRefreshToken
    );
  }

  async upload(videoPath: string, metadata: UploadMetadata): Promise<UploadResult> {
    log("youtube", "Starting upload...");

    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    const auth = this.buildOAuthClient();
    const youtube = google.youtube({ version: "v3", auth });

    const fileSize = fs.statSync(videoPath).size;
    // VP_YT_PRIVACY = "public" | "unlisted" | "private". Defaults to public
    // to match prior behavior. Operators set "unlisted" for previews.
    const requestedPrivacy = (process.env.VP_YT_PRIVACY || "public").toLowerCase();
    const privacyStatus = ["public", "unlisted", "private"].includes(requestedPrivacy)
      ? (requestedPrivacy as "public" | "unlisted" | "private")
      : "public";
    log("youtube", `Title: ${metadata.title}`);
    log("youtube", `File size: ${(fileSize / 1024 / 1024).toFixed(1)} MB`);
    log("youtube", `Privacy: ${privacyStatus}`);

    const response = await youtube.videos.insert(
      {
        part: ["snippet", "status"],
        requestBody: {
          snippet: {
            title: metadata.title,
            description: metadata.description,
            tags: metadata.tags,
            categoryId: metadata.categoryId,
            defaultLanguage: "en",
          },
          status: {
            privacyStatus,
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          mimeType: "video/mp4",
          body: fs.createReadStream(videoPath),
        },
      },
      {
        onUploadProgress: (evt: { bytesRead: number }) => {
          const pct = Math.round((evt.bytesRead / fileSize) * 100);
          process.stdout.write(`\r  Uploading... ${pct}%`);
        },
      },
    );

    process.stdout.write("\n");

    const videoId = response.data.id!;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    log("youtube", "Upload complete!");
    log("youtube", `Video URL: ${videoUrl}`);

    return { platform: this.platform, id: videoId, url: videoUrl, title: metadata.title };
  }

  private buildOAuthClient() {
    if (!this.config.youTubeClientId || !this.config.youTubeClientSecret || !this.config.youTubeRefreshToken) {
      throw new Error(
        "Missing YouTube credentials. Ensure YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN are set in .env",
      );
    }

    const oauth2 = new google.auth.OAuth2(
      this.config.youTubeClientId,
      this.config.youTubeClientSecret,
      "urn:ietf:wg:oauth:2.0:oob",
    );

    oauth2.setCredentials({ refresh_token: this.config.youTubeRefreshToken });
    return oauth2;
  }
}
