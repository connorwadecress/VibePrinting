import "dotenv/config";
import { loadConfig } from "./config.js";
import { loadProfile } from "./domain/channel-profile.js";
import { resolveBrand, loadBrandEnv, listBrands } from "./utils/brand-resolver.js";

function main(): void {
  const brandArg = process.argv.find((a) => a.startsWith("--brand="))?.split("=")[1];
  const brand = resolveBrand(brandArg);
  if (brand) loadBrandEnv(brand);

  const config = loadConfig();
  const profile = loadProfile(brand?.profilePath);

  const configuredServices = [
    config.anthropicApiKey ? "Claude" : undefined,
    config.geminiApiKey ? "Gemini" : undefined,
    config.pexelsApiKey ? "Pexels" : undefined,
    config.n8nApiKey && config.n8nBaseUrl ? "n8n" : undefined,
    config.youTubeChannelId ? "YouTube" : undefined,
    config.tikTokClientKey && config.tikTokRefreshToken ? "TikTok" : undefined,
  ].filter(Boolean);

  console.log("Vibe Printing bootstrap");
  console.log("=======================");
  console.log("");
  console.log(`Theme: ${profile.id}`);
  console.log(`Thesis: ${profile.thesis}`);
  console.log("");
  console.log("Content lanes:");
  for (const lane of profile.contentLanes) {
    console.log(`  - ${lane.id}: ${lane.description}`);
  }
  console.log("");
  console.log(`Default daily target: ${config.defaultDailyTarget}`);
  console.log(`LLM provider: ${config.llmProvider} (${config.llmProvider === "claude" ? config.claudeModel : config.geminiModel})`);
  console.log(`TTS voice: ${profile.ttsVoice}`);
  console.log(
    `Configured services: ${configuredServices.length > 0 ? configuredServices.join(", ") : "none"}`,
  );
  const availableBrands = listBrands();
  if (availableBrands.length > 0) {
    console.log(`Available brands: ${availableBrands.join(", ")}`);
  }
  console.log("");
  console.log("Run: npm run generate         (full pipeline)");
  console.log("     npm run generate --dry-run (script only)");
  console.log("     npm run generate -- --brand=<id> --dry-run");
}

main();
