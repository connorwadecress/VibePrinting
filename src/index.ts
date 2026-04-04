import { loadConfig } from "./config.js";
import { describeBlueprint } from "./pipeline/blueprint.js";

function main(): void {
  const config = loadConfig();
  const configuredServices = [
    config.anthropicApiKey ? "Claude" : undefined,
    config.geminiApiKey ? "Gemini" : undefined,
    config.pexelsApiKey ? "Pexels" : undefined,
    config.n8nApiKey && config.n8nBaseUrl ? "n8n" : undefined,
    config.youTubeChannelId ? "YouTube" : undefined,
  ].filter(Boolean);

  console.log("Vibe Printing bootstrap");
  console.log("=======================");
  console.log("");
  console.log(describeBlueprint());
  console.log("");
  console.log(`Default daily target: ${config.defaultDailyTarget}`);
  console.log(`LLM provider: ${config.llmProvider} (${config.llmProvider === "claude" ? config.claudeModel : config.geminiModel})`);
  console.log(`TTS voice: ${config.ttsVoice}`);
  console.log(
    `Configured services: ${configuredServices.length > 0 ? configuredServices.join(", ") : "none"}`
  );
  console.log("");
  console.log("Run: npm run generate         (full pipeline)");
  console.log("     npm run generate --dry-run (script only)");
}

main();
