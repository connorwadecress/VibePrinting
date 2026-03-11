import { loadConfig } from "./config.js";
import { describeBlueprint } from "./pipeline/blueprint.js";

function main(): void {
  const config = loadConfig();
  const configuredServices = [
    config.openAiApiKey ? "OpenAI" : undefined,
    config.n8nApiKey && config.n8nBaseUrl ? "n8n" : undefined,
    config.youTubeChannelId ? "YouTube" : undefined
  ].filter(Boolean);

  console.log("Vibe Printing bootstrap");
  console.log("=======================");
  console.log("");
  console.log(describeBlueprint());
  console.log("");
  console.log(`Default daily target: ${config.defaultDailyTarget}`);
  console.log(`Text model: ${config.openAiTextModel}`);
  console.log(`Fast model: ${config.openAiFastModel}`);
  console.log(`TTS model: ${config.openAiTtsModel}`);
  console.log(`Video model: ${config.openAiVideoModel}`);
  console.log(
    `Configured services: ${configuredServices.length > 0 ? configuredServices.join(", ") : "none"}`
  );
}

main();
