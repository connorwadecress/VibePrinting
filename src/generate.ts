import "dotenv/config";
import { loadConfig } from "./config.js";
import { runPipeline } from "./pipeline/runner.js";
import { logError } from "./utils/logger.js";

function parseArgs(): { lane?: string; dryRun: boolean; upload: boolean } {
  const args = process.argv.slice(2);
  let lane: string | undefined;
  let dryRun = false;
  let upload = false;

  for (const arg of args) {
    if (arg.startsWith("--lane=")) lane = arg.split("=")[1];
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--upload") upload = true;
  }

  return { lane, dryRun, upload };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const { lane, dryRun, upload } = parseArgs();

  console.log("=== Vibe Printing - Free-Tier Pipeline ===");
  console.log(`LLM: ${config.llmProvider} (${config.llmProvider === "claude" ? config.claudeModel : config.geminiModel})`);
  console.log(`Mode: ${dryRun ? "dry-run (script only)" : "full pipeline"}`);
  console.log();

  const result = await runPipeline(config, { lane, dryRun, upload });

  if (result.outputVideoPath) {
    console.log(`\nDone! Video: ${result.outputVideoPath}`);
    if (result.youTubeVideoUrl) console.log(`  YouTube: ${result.youTubeVideoUrl}`);
    if (result.tikTokVideoUrl)  console.log(`  TikTok:  ${result.tikTokVideoUrl}`);
  }
}

main().catch((err) => {
  logError("main", err.message);
  process.exit(1);
});
