/**
 * retry-upload.ts
 *
 * Re-uploads a previously generated video to a specific platform
 * without re-running the full pipeline.
 *
 * Usage:
 *   tsx src/retry-upload.ts --platform=tiktok
 *   tsx src/retry-upload.ts --platform=youtube --run=run-20260405-004301
 *   tsx src/retry-upload.ts --platform=tiktok --dir=./output/legacy
 *   tsx src/retry-upload.ts --platform=tiktok --dir=./output/legacy --all
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "./config.js";
import { loadProfile } from "./domain/channel-profile.js";
import type { UploadMetadata } from "./domain/interfaces/uploader.js";
import type { ShortScript } from "./domain/models.js";
import { TikTokUploader } from "./providers/upload/tiktok.js";
import { YouTubeUploader } from "./providers/upload/youtube.js";
import { log, logError } from "./utils/logger.js";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  let platform: string | undefined;
  let runId: string | undefined;
  let dir: string | undefined;
  let all = false;

  for (const arg of args) {
    if (arg.startsWith("--platform=")) platform = arg.split("=")[1];
    else if (arg.startsWith("--run=")) runId = arg.split("=")[1];
    else if (arg.startsWith("--dir=")) dir = arg.split("=")[1];
    else if (arg === "--all") all = true;
    else if (!arg.startsWith("--")) platform ??= arg; // positional fallback
  }

  if (!platform) {
    console.error("Usage: tsx src/retry-upload.ts --platform=<tiktok|youtube> [--run=<run-id>] [--dir=<path>] [--all]");
    process.exit(1);
  }

  return { platform: platform.toLowerCase(), runId, dir, all };
}

// ---------------------------------------------------------------------------
// Find latest run directory
// ---------------------------------------------------------------------------

function findRunDir(outputDir: string, runId?: string): string {
  if (runId) {
    const explicit = path.resolve(outputDir, runId);
    if (fs.existsSync(explicit)) return explicit;
    throw new Error(`Run directory not found: ${explicit}`);
  }

  // Find the most recent run-* directory
  const entries = fs
    .readdirSync(outputDir)
    .filter((e) => e.startsWith("run-") && fs.statSync(path.join(outputDir, e)).isDirectory())
    .sort()
    .reverse();

  if (entries.length === 0) {
    throw new Error(`No run directories found in ${outputDir}`);
  }

  return path.resolve(outputDir, entries[0]);
}

// ---------------------------------------------------------------------------
// Build upload metadata (same logic as UploadStage.buildMetadata)
// ---------------------------------------------------------------------------

function buildMetadata(script: ShortScript, profile: ReturnType<typeof loadProfile>): UploadMetadata {
  const { branding, genSecDefaults } = profile;
  const pub = script.publishMeta;

  const rawTitle = (pub?.youtubeTitle || script.hook).replace(/[<>]/g, "").trim();
  const title = rawTitle.length > 100 ? rawTitle.substring(0, 97) + "..." : rawTitle;

  const description = pub?.youtubeDescription
    ? [
        pub.youtubeDescription,
        "",
        "---",
        branding.hashtags.join(" "),
        ...(pub.topicHashtags ?? []).filter((h) => !branding.hashtags.includes(h)),
      ].join("\n")
    : [
        script.hook,
        "",
        script.beats.map((b) => b.narration).join(" "),
        "",
        script.payoff,
        "",
        "---",
        script.callToAction,
        "",
        branding.hashtags.join(" "),
      ].join("\n");

  const tags = [...branding.tags, ...(pub?.topicTags ?? [])];

  const allHashtags = [...branding.hashtags];
  for (const h of pub?.topicHashtags ?? []) {
    if (!allHashtags.includes(h)) allHashtags.push(h);
  }

  return {
    title,
    description,
    tags,
    hashtags: allHashtags,
    categoryId: branding.youTubeCategory,
    disclosureRequired: genSecDefaults.disclosureRequired,
  };
}

// ---------------------------------------------------------------------------
// Upload a single run directory
// ---------------------------------------------------------------------------

async function uploadRun(
  runDir: string,
  uploader: { platform: string; upload: (v: string, m: UploadMetadata) => Promise<any> },
  profile: ReturnType<typeof loadProfile>,
): Promise<boolean> {
  const videoPath = path.join(runDir, "final.mp4");
  const scriptPath = path.join(runDir, "script.json");

  if (!fs.existsSync(videoPath) || !fs.existsSync(scriptPath)) {
    log("retry", `Skipping ${path.basename(runDir)} — missing final.mp4 or script.json`);
    return false;
  }

  const scriptData = JSON.parse(fs.readFileSync(scriptPath, "utf-8")) as { script: ShortScript };
  const metadata = buildMetadata(scriptData.script, profile);

  log("retry", `Title: ${metadata.title}`);
  log("retry", `Video: ${videoPath}`);

  const startMs = Date.now();
  const result = await uploader.upload(videoPath, metadata);
  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

  log("retry", `Upload complete in ${elapsed}s`);
  log("retry", `${result.platform}: ${result.url}`);
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { platform, runId, dir, all } = parseArgs();
  const config = loadConfig();
  const profile = loadProfile();
  const outputDir = dir ? path.resolve(dir) : config.outputDir;

  // Pick the right uploader
  const uploaders = {
    tiktok: () => new TikTokUploader(config),
    youtube: () => new YouTubeUploader(config),
  };

  const factory = uploaders[platform as keyof typeof uploaders];
  if (!factory) {
    throw new Error(`Unknown platform "${platform}". Use: tiktok, youtube`);
  }

  const uploader = factory();

  if (!uploader.isConfigured()) {
    throw new Error(`${platform} is not configured. Check your .env credentials.`);
  }

  if (all) {
    // Upload all runs in the directory
    const entries = fs
      .readdirSync(outputDir)
      .filter((e) => e.startsWith("run-") && fs.statSync(path.join(outputDir, e)).isDirectory())
      .sort();

    log("retry", `Uploading all runs from ${outputDir} to ${platform}`);
    log("retry", `Found ${entries.length} run directories`);

    let success = 0;
    let skipped = 0;
    let failed = 0;

    for (const entry of entries) {
      const runDir = path.resolve(outputDir, entry);
      log("retry", `\n=== ${entry} ===`);

      try {
        const uploaded = await uploadRun(runDir, uploader, profile);
        if (uploaded) success++;
        else skipped++;
      } catch (err: any) {
        logError("retry", `${entry} failed: ${err.message}`);
        failed++;
      }
    }

    log("retry", `\n=== Done === ${success} uploaded, ${skipped} skipped, ${failed} failed`);
  } else {
    // Single run
    const runDir = findRunDir(outputDir, runId);
    log("retry", `Run directory: ${runDir}`);
    log("retry", `Platform: ${platform}`);
    await uploadRun(runDir, uploader, profile);
  }
}

main().catch((err) => {
  logError("retry", err.message ?? err);
  process.exit(1);
});
