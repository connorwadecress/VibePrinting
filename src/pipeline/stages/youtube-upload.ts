import { google } from "googleapis";
import fs from "node:fs";
import path from "node:path";
import type { AppConfig } from "../../config.js";
import type { ShortScript } from "../../domain/models.js";
import { log, logError } from "../../utils/logger.js";

export interface YouTubeUploadResult {
  videoId: string;
  videoUrl: string;
  title: string;
}

/**
 * Builds an OAuth2 client using credentials from config.
 * Uses the stored refresh token so no browser interaction is needed at runtime.
 */
function buildOAuthClient(config: AppConfig) {
  if (!config.youTubeClientId || !config.youTubeClientSecret || !config.youTubeRefreshToken) {
    throw new Error(
      "Missing YouTube credentials. Ensure YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN are set in .env"
    );
  }

  const oauth2 = new google.auth.OAuth2(
    config.youTubeClientId,
    config.youTubeClientSecret,
    "urn:ietf:wg:oauth:2.0:oob" // Desktop app redirect URI
  );

  oauth2.setCredentials({ refresh_token: config.youTubeRefreshToken });
  return oauth2;
}

/**
 * Builds a video title and description from the script.
 */
function buildVideoMetadata(script: ShortScript): { title: string; description: string; tags: string[] } {
  // Use hook as title (trim to YouTube's 100 char limit)
  const rawTitle = script.hook.replace(/[<>]/g, "").trim();
  const title = rawTitle.length > 100 ? rawTitle.substring(0, 97) + "..." : rawTitle;

  const description = [
    script.hook,
    "",
    script.beats.map((b) => b.narration).join(" "),
    "",
    script.payoff,
    "",
    "---",
    script.callToAction,
    "",
    "#SignalDrop #Shorts",
  ].join("\n");

  const tags = ["SignalDrop", "Shorts", "YouTube Shorts", "viral", "trending"];

  return { title, description, tags };
}

/**
 * Uploads the final MP4 to the SignalDrop YouTube channel.
 * Uses resumable upload — safe for large files and resumable on failure.
 */
export async function uploadToYouTube(
  videoPath: string,
  script: ShortScript,
  config: AppConfig
): Promise<YouTubeUploadResult> {
  log("youtube", "Starting upload to SignalDrop...");

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const auth = buildOAuthClient(config);
  const youtube = google.youtube({ version: "v3", auth });

  const { title, description, tags } = buildVideoMetadata(script);
  const fileSize = fs.statSync(videoPath).size;

  log("youtube", `Title: ${title}`);
  log("youtube", `File size: ${(fileSize / 1024 / 1024).toFixed(1)} MB`);

  const response = await youtube.videos.insert(
    {
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title,
          description,
          tags,
          categoryId: "22", // People & Blogs — good catch-all for mixed content
          defaultLanguage: "en",
        },
        status: {
          privacyStatus: "public",   // Change to "private" or "unlisted" to review before going live
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        mimeType: "video/mp4",
        body: fs.createReadStream(videoPath),
      },
    },
    {
      // Resumable upload — handles large files gracefully
      onUploadProgress: (evt: { bytesRead: number }) => {
        const pct = Math.round((evt.bytesRead / fileSize) * 100);
        process.stdout.write(`\r  Uploading... ${pct}%`);
      },
    }
  );

  process.stdout.write("\n");

  const videoId = response.data.id!;
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  log("youtube", `Upload complete!`);
  log("youtube", `Video URL: ${videoUrl}`);

  return { videoId, videoUrl, title };
}
