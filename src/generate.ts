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
import { MockFootageProvider } from "./providers/footage/mock.js";
import { FfmpegAssembler } from "./providers/video/ffmpeg-assembler.js";
import { YouTubeUploader } from "./providers/upload/youtube.js";
import { TikTokUploader } from "./providers/upload/tiktok.js";
import { buildShortsPipeline } from "./pipeline/presets/shorts-pipeline.js";
import { runPipeline } from "./pipeline/runner.js";
import { createRunDir, ensureDir } from "./utils/fs-helpers.js";
import { loadTopicHistory, appendTopicHistory } from "./utils/topic-history.js";
import { resolveBrand, loadBrandEnv } from "./utils/brand-resolver.js";
import {
  describeResumedState,
  loadRunState,
  parseRunIdFromDir,
  resolveResumeDir,
} from "./utils/run-resume.js";
import { log, logError } from "./utils/logger.js";
import fs from "node:fs";
import path from "node:path";

interface CliArgs {
  brand?: string;
  lane?: string;
  dryRun: boolean;
  upload: boolean;
  resume?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const out: CliArgs = { dryRun: false, upload: false };

  for (const arg of args) {
    if (arg.startsWith("--brand=")) out.brand = arg.split("=")[1];
    else if (arg.startsWith("--lane=")) out.lane = arg.split("=")[1];
    else if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--upload") out.upload = true;
    else if (arg.startsWith("--resume=")) out.resume = arg.split("=").slice(1).join("=");
    else if (arg === "--resume") out.resume = "latest";
  }

  return out;
}

async function main(): Promise<void> {
  const { brand: brandArg, lane: laneArg, dryRun, upload, resume } = parseArgs();

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
  console.log(`Mode: ${resume ? "resume" : dryRun ? "dry-run (script only)" : "full pipeline"}`);
  console.log();

  // --- Set up run dir and pre-state ---
  // Resume: rehydrate state from an existing run dir; lane is read from the
  // persisted topic. Fresh: create a new run dir and pick a lane normally.
  let runId: string;
  let workDir: string;
  let initialState: PipelineState;

  if (resume) {
    workDir = resolveResumeDir(resume, config.outputDir);
    runId = parseRunIdFromDir(workDir);
    ensureDir(path.join(workDir, "clips"));
    initialState = loadRunState(workDir, profile);
    log("pipeline", `Resume: ${runId} -> ${workDir}`);
    log("pipeline", `Loaded: [${describeResumedState(initialState).join(", ") || "nothing"}]`);

    if (laneArg && initialState.lane && initialState.lane.id !== laneArg) {
      log("pipeline", `Note: --lane=${laneArg} ignored on resume (using persisted lane ${initialState.lane.id})`);
    }
    if (!initialState.lane) {
      const fallbackLane = pickLane(profile.contentLanes, laneArg);
      initialState.lane = fallbackLane;
      log("pipeline", `Resume had no persisted lane — using ${fallbackLane.id}`);
    }
  } else {
    const fresh = createRunDir(config.outputDir);
    runId = fresh.runId;
    workDir = fresh.workDir;
    log("pipeline", `Run: ${runId} -> ${workDir}`);
    initialState = { lane: pickLane(profile.contentLanes, laneArg) };
    log("pipeline", `Lane: ${initialState.lane!.id}`);
  }

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
    footage: config.llmProvider === "mock"
      ? new MockFootageProvider()
      : new PexelsProvider(config.pexelsApiKey ?? ""),
    assembler: new FfmpegAssembler(videoSpec),
    uploaders: filteredUploaders,
    profile,
    videoSpec,
    config,
    workDir,
    runId,
    topicHistory,
  };

  // --- Build and run pipeline ---
  const stages = buildShortsPipeline({ dryRun, upload });
  const result = await runPipeline(stages, context, initialState);

  // --- Save script for review ---
  if (result.script) {
    fs.writeFileSync(
      path.join(workDir, "script.json"),
      JSON.stringify({ topic: result.topic, research: result.research, script: result.script }, null, 2),
    );
  }

  // --- Append to topic history (only on a fresh run; resumes reuse the original entry) ---
  if (!resume && result.topic) {
    const today = new Date().toISOString().slice(0, 10);
    appendTopicHistory(historyPath, {
      laneId: result.topic.laneId,
      titleAngle: result.topic.titleAngle,
      seedQuestion: result.topic.seedQuestion,
      runId,
      date: today,
    });
  }

  // --- Print results ---
  if (dryRun && result.script) {
    printScript(result.script);
  }

  if (result.halted) {
    console.log(`\nPipeline halted for review: ${result.haltReason}`);
    if (result.haltedGateId) {
      console.log(`Approval file: ${path.join(workDir, "approvals", `${result.haltedGateId}.json`)}`);
    }
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

function pickLane(lanes: ContentLane[], laneArg: string | undefined): ContentLane {
  if (laneArg) {
    const found = lanes.find((l) => l.id === laneArg);
    if (!found) throw new Error(`Unknown lane: ${laneArg}. Available: ${lanes.map((l) => l.id).join(", ")}`);
    return found;
  }
  return lanes[Math.floor(Math.random() * lanes.length)];
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
