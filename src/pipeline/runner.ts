import type { AppConfig } from "../config.js";
import type {
  ContentLane,
  PipelineContext,
  PipelineResult,
} from "../domain/models.js";
import { createLlmClient } from "../providers/llm.js";
import { recommendedTheme } from "./blueprint.js";
import { discoverTopic } from "./stages/topic-discovery.js";
import { buildResearchPack } from "./stages/research-pack.js";
import { generateScript } from "./stages/script-generation.js";
import { planScenes } from "./stages/scene-plan.js";
import { createVoiceover } from "./stages/voiceover.js";
import { fetchStockFootage } from "./stages/stock-footage.js";
import { assembleShort } from "./stages/assembly.js";
import { uploadToYouTube } from "./stages/youtube-upload.js";
import { uploadToTikTok } from "./stages/tiktok-upload.js";
import { log, logError, logTiming } from "../utils/logger.js";
import { createRunDir } from "../utils/fs-helpers.js";
import fs from "node:fs";
import path from "node:path";

export interface RunOptions {
  lane?: string;
  seedTopic?: string;
  dryRun?: boolean;
  upload?: boolean;
}

export async function runPipeline(
  config: AppConfig,
  options: RunOptions = {},
): Promise<PipelineResult> {
  const pipelineStart = Date.now();

  // Pick content lane
  const lanes = recommendedTheme.contentLanes;
  let lane: ContentLane;
  if (options.lane) {
    const found = lanes.find((l) => l.id === options.lane);
    if (!found) throw new Error(`Unknown lane: ${options.lane}. Available: ${lanes.map((l) => l.id).join(", ")}`);
    lane = found;
  } else {
    lane = lanes[Math.floor(Math.random() * lanes.length)];
  }

  log("pipeline", `Lane: ${lane.id}`);

  // Create run directory
  const { runId, workDir } = createRunDir(config.outputDir);
  log("pipeline", `Run: ${runId} -> ${workDir}`);

  const context: PipelineContext = { runId, workDir, config };
  const llm = createLlmClient(config);

  // Stage 1: Topic Discovery
  const topic = await discoverTopic(llm, lane);

  // Stage 2: Research Pack
  const research = await buildResearchPack(llm, topic);

  // Stage 3: Script Generation
  const script = await generateScript(llm, topic, research, lane);

  // Save script for review
  fs.writeFileSync(
    path.join(workDir, "script.json"),
    JSON.stringify({ topic, research, script }, null, 2),
  );

  if (options.dryRun) {
    log("pipeline", "Dry run — stopping after script generation.");
    printScript(script);
    return {
      topic,
      research,
      script,
      scenes: [],
      voiceover: { audioPath: "", durationSeconds: 0, subtitles: [] },
      clips: [],
      outputVideoPath: "",
    };
  }

  // Stage 4: Scene Plan
  const scenes = await planScenes(llm, script);

  // Stage 5: Voiceover
  const voiceover = await createVoiceover(script, workDir, config);

  // Stage 6: Stock Footage
  if (!config.pexelsApiKey) throw new Error("PEXELS_API_KEY required for video generation");
  const clips = await fetchStockFootage(scenes, workDir, config.pexelsApiKey);

  // Stage 7: Assembly
  const outputVideoPath = await assembleShort(scenes, clips, voiceover, script, workDir);

  // GenSec review — skipped for MVP
  log("gensec", "GenSec review skipped (MVP mode). Manual review recommended.");

  // Stage 8: Upload (optional — pass --upload flag)
  // When --upload is set, uploads to all configured platforms in parallel.
  let youTubeVideoId: string | undefined;
  let youTubeVideoUrl: string | undefined;
  let tikTokPublishId: string | undefined;
  let tikTokVideoUrl: string | undefined;

  if (options.upload) {
    const uploadPromises: Promise<void>[] = [];

    // YouTube upload
    const hasYouTubeCredentials = config.youTubeClientId && config.youTubeClientSecret && config.youTubeRefreshToken;
    if (hasYouTubeCredentials) {
      uploadPromises.push(
        uploadToYouTube(outputVideoPath, script, config)
          .then((result) => {
            youTubeVideoId = result.videoId;
            youTubeVideoUrl = result.videoUrl;
            log("pipeline", `YouTube: ${youTubeVideoUrl}`);
          })
          .catch((err: any) => {
            logError("youtube", `Upload failed: ${err.message}`);
            log("youtube", "Video was saved locally. You can upload manually.");
          })
      );
    } else {
      log("pipeline", "YouTube upload skipped — credentials not configured.");
    }

    // TikTok upload
    const hasTikTokCredentials =
      config.tikTokClientKey && config.tikTokClientSecret &&
      (config.tikTokAccessToken || config.tikTokRefreshToken);
    if (hasTikTokCredentials) {
      uploadPromises.push(
        uploadToTikTok(outputVideoPath, script, config)
          .then((result) => {
            tikTokPublishId = result.publishId;
            tikTokVideoUrl = result.videoUrl;
            log("pipeline", `TikTok: ${tikTokVideoUrl}`);
          })
          .catch((err: any) => {
            logError("tiktok", `Upload failed: ${err.message}`);
            log("tiktok", "Video was saved locally. You can upload manually.");
          })
      );
    } else {
      log("pipeline", "TikTok upload skipped — credentials not configured.");
    }

    // Run all platform uploads in parallel
    await Promise.all(uploadPromises);
  }

  logTiming("pipeline", pipelineStart);
  log("pipeline", `Output: ${outputVideoPath}`);

  return {
    topic, research, script, scenes, voiceover, clips, outputVideoPath,
    youTubeVideoId, youTubeVideoUrl,
    tikTokPublishId, tikTokVideoUrl,
  };
}

function printScript(script: import("../domain/models.js").ShortScript): void {
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
