import "dotenv/config";
import { loadConfig } from "./config.js";
import { loadProfile } from "./domain/channel-profile.js";
import { SHORTS_PORTRAIT } from "./domain/video-specs.js";
import type { StageContext } from "./domain/interfaces/pipeline-stage.js";
import type { ContentLane, PipelineState, ShortScript } from "./domain/models.js";
import { createLlmClient } from "./providers/llm/index.js";
import { EdgeTtsProvider } from "./providers/tts/edge-tts.js";
import { ElevenLabsProvider } from "./providers/tts/elevenlabs.js";
import { PexelsProvider } from "./providers/footage/pexels.js";
import { LibraryGameplayProvider } from "./providers/gameplay/library.js";
import { YtDlpGameplayProvider } from "./providers/gameplay/yt-dlp.js";
import { CompositeGameplayProvider } from "./providers/gameplay/composite.js";
import { LibraryMusicProvider } from "./providers/music/library.js";
import { FfmpegAssembler } from "./providers/video/ffmpeg-assembler.js";
import { YouTubeUploader } from "./providers/upload/youtube.js";
import { TikTokUploader } from "./providers/upload/tiktok.js";
import { buildShortsPipeline } from "./pipeline/presets/shorts-pipeline.js";
import { buildRedditStoryPipeline } from "./pipeline/presets/reddit-story-pipeline.js";
import { runPipeline } from "./pipeline/runner.js";
import { createRunDir } from "./utils/fs-helpers.js";
import { loadTopicHistory, appendTopicHistory } from "./utils/topic-history.js";
import { resolveBrand, loadBrandEnv } from "./utils/brand-resolver.js";
import { log, logError } from "./utils/logger.js";
import fs from "node:fs";
import path from "node:path";

function parseArgs(): { brand?: string; lane?: string; dryRun: boolean; upload: boolean } {
  const args = process.argv.slice(2);
  let brand: string | undefined;
  let lane: string | undefined;
  let dryRun = false;
  let upload = false;

  for (const arg of args) {
    if (arg.startsWith("--brand=")) brand = arg.split("=")[1];
    else if (arg.startsWith("--lane=")) lane = arg.split("=")[1];
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--upload") upload = true;
  }

  return { brand, lane, dryRun, upload };
}

async function main(): Promise<void> {
  const { brand: brandArg, lane: laneArg, dryRun, upload } = parseArgs();

  // --- Resolve brand and overlay brand-specific .env ---
  const brand = resolveBrand(brandArg);
  if (brand) {
    loadBrandEnv(brand);
    log("pipeline", `Brand: ${brand.brandId}`);
  }

  const config = loadConfig();

  // --- Load channel profile from brand folder or root channel.json ---
  const profile = loadProfile(brand?.profilePath);
  const videoSpec = SHORTS_PORTRAIT;

  console.log("=== Vibe Printing - Free-Tier Pipeline ===");
  console.log(`Channel: ${profile.displayName}`);
  console.log(`LLM: ${config.llmProvider} (${config.llmProvider === "claude" ? config.claudeModel : config.geminiModel})`);
  console.log(`Mode: ${dryRun ? "dry-run (script only)" : "full pipeline"}`);
  console.log();

  // --- Pick content lane ---
  const lanes = profile.contentLanes;
  let lane: ContentLane;
  if (laneArg) {
    const found = lanes.find((l) => l.id === laneArg);
    if (!found) throw new Error(`Unknown lane: ${laneArg}. Available: ${lanes.map((l) => l.id).join(", ")}`);
    lane = found;
  } else {
    lane = lanes[Math.floor(Math.random() * lanes.length)];
  }
  log("pipeline", `Lane: ${lane.id}`);

  // --- Create run directory ---
  const { runId, workDir } = createRunDir(config.outputDir);
  log("pipeline", `Run: ${runId} -> ${workDir}`);

  // --- Load topic history ---
  const historyPath = brand
    ? path.join(brand.brandDir, "topic-history.json")
    : path.resolve("topic-history.json");
  const topicHistory = loadTopicHistory(historyPath, config.outputDir);
  log("pipeline", `Topic history: ${topicHistory.length} topics loaded`);

  // --- Resolve effective TTS provider: brand override wins, otherwise global config ---
  const effectiveTtsProvider = profile.ttsProvider ?? config.ttsProvider;
  const brandElevenLabs = profile.ttsProviderSettings?.elevenLabs;

  // --- Filter uploaders by VP_PLATFORMS env var if set (set by web job-manager) ---
  const platformFilter = process.env.VP_PLATFORMS
    ? new Set(process.env.VP_PLATFORMS.split(",").map((p) => p.trim()).filter(Boolean))
    : null;
  const allUploaders = [new YouTubeUploader(config), new TikTokUploader(config)];
  const filteredUploaders = platformFilter
    ? allUploaders.filter((u) => platformFilter.has(u.platform))
    : allUploaders;
  if (platformFilter) {
    log("pipeline", `VP_PLATFORMS=${process.env.VP_PLATFORMS} -> ${filteredUploaders.map((u) => u.platform).join(",") || "none"}`);
  }

  // --- Resolve reddit-story support paths (only used by reddit-story lanes) ---
  const brandRoot = brand?.brandDir;
  const gameplayLibraryDir = profile.gameplayLibraryDir
    ?? (brandRoot ? path.join(brandRoot, "gameplay") : path.resolve("gameplay"));
  const musicLibraryDir = profile.musicLibraryDir
    ?? (brandRoot ? path.join(brandRoot, "music") : path.resolve("music"));
  const ytDlpFallbackUrls = profile.ytDlpFallbackUrls ?? [];

  const ytDlpProvider = ytDlpFallbackUrls.length > 0
    ? new YtDlpGameplayProvider(
        ytDlpFallbackUrls,
        path.join(config.outputDir, ".gameplay-cache"),
      )
    : null;
  const gameplayProvider = new CompositeGameplayProvider(
    new LibraryGameplayProvider(gameplayLibraryDir, profile.gameplayLibrary),
    ytDlpProvider,
  );
  const musicProvider = new LibraryMusicProvider(musicLibraryDir, profile.musicLibrary);

  // --- Wire providers (composition root) ---
  const context: StageContext = {
    llm: createLlmClient(config),
    tts: effectiveTtsProvider === "elevenlabs"
      ? new ElevenLabsProvider(
          config.elevenLabsApiKey ?? (() => { throw new Error("ELEVENLABS_API_KEY is required"); })(),
          brandElevenLabs?.voiceId ?? config.elevenLabsVoiceId,
          brandElevenLabs?.modelId ?? config.elevenLabsModelId,
          brandElevenLabs?.speed ?? config.elevenLabsSpeed,
        )
      : new EdgeTtsProvider(profile.ttsVoice, profile.ttsRate),
    footage: new PexelsProvider(config.pexelsApiKey ?? ""),
    gameplay: gameplayProvider,
    music: musicProvider,
    assembler: new FfmpegAssembler(videoSpec),
    uploaders: filteredUploaders,
    profile,
    videoSpec,
    config,
    workDir,
    runId,
    topicHistory,
  };

  // --- Build and run pipeline (dispatch by lane type) ---
  const laneType = lane.type ?? "pexels-api";
  log("pipeline", `Lane type: ${laneType}`);
  let stages;
  switch (laneType) {
    case "reddit-story":
      stages = buildRedditStoryPipeline({ dryRun, upload });
      break;
    case "pexels-api":
    default:
      stages = buildShortsPipeline({ dryRun, upload });
      break;
  }
  const state: PipelineState = { lane };
  const result = await runPipeline(stages, context, state);

  // --- Save script for review ---
  if (result.script || result.redditScript) {
    fs.writeFileSync(
      path.join(workDir, "script.json"),
      JSON.stringify(
        {
          topic: result.topic,
          research: result.research,
          script: result.script,
          redditPost: result.redditPost,
          redditScript: result.redditScript,
        },
        null,
        2,
      ),
    );
  }

  // --- Append to topic history ---
  const today = new Date().toISOString().slice(0, 10);
  if (result.topic) {
    appendTopicHistory(historyPath, {
      laneId: result.topic.laneId,
      titleAngle: result.topic.titleAngle,
      seedQuestion: result.topic.seedQuestion,
      runId,
      date: today,
    });
  } else if (result.redditScript) {
    const post = result.redditScript.post;
    appendTopicHistory(historyPath, {
      laneId: lane.id,
      titleAngle: post.title,
      seedQuestion: `r/${post.subreddit}`,
      runId,
      date: today,
      redditPostId: post.id,
    });
  }

  // --- Print results ---
  if (dryRun && result.script) {
    printScript(result.script);
  }

  if (result.outputVideoPath) {
    console.log(`\nDone! Video: ${result.outputVideoPath}`);
  }

  if (result.uploadResults) {
    for (const r of result.uploadResults) {
      console.log(`  ${r.platform}: ${r.url}`);
    }
  }

  log("pipeline", `Output: ${workDir}`);
}

function printScript(script: ShortScript): void {
  console.log("\n========== SCRIPT ==========");
  console.log(`HOOK: ${script.hook}\n`);
  for (const beat of script.beats) {
    console.log(`[Beat ${beat.beatIndex}] ${beat.narration}`);
    console.log(`  Visual: ${beat.visualIntent}\n`);
  }
  console.log(`PAYOFF: ${script.payoff}`);
  console.log(`CTA: ${script.callToAction}`);
  console.log(`Duration: ~${script.totalDurationSeconds}s`);
  console.log("============================\n");
}

main().catch((err) => {
  logError("main", err.message);
  process.exit(1);
});
