import type { ShortScript, ScenePlanWithKeywords } from "../../domain/models.js";
import type { LlmClient } from "../../providers/llm.js";
import { log } from "../../utils/logger.js";

const SYSTEM_PROMPT = `You are a visual planner for YouTube Shorts. Convert script beats into scene plans with stock footage search keywords.

For each scene, provide:
- A visual description (what the viewer sees)
- Caption text to display on screen (short, punchy, max 8 words)
- Duration in seconds
- 2-3 stock footage search keywords for Pexels (specific, visual, searchable terms)

The first scene should be the hook. The last scene should be the payoff + CTA.

Respond with JSON array:
[
  {
    "sceneIndex": number,
    "prompt": string (visual description),
    "captions": [string],
    "seconds": number,
    "searchKeywords": [string]
  }
]

Keep keywords concrete and visual: "ancient roman building" not "historical concept". Pexels has stock footage, so think about what footage exists: cities, nature, people, technology, food, sports, etc.`;

export async function planScenes(
  llm: LlmClient,
  script: ShortScript,
): Promise<ScenePlanWithKeywords[]> {
  log("scene-plan", "Planning scenes...");

  const beatsText = script.beats
    .map((b) => `Beat ${b.beatIndex}: "${b.narration}" (Visual: ${b.visualIntent})`)
    .join("\n");

  const userPrompt = `Script:
Hook: "${script.hook}"
${beatsText}
Payoff: "${script.payoff}"
CTA: "${script.callToAction}"
Total duration: ~${script.totalDurationSeconds} seconds

Plan scenes for this script. Ensure total scene durations roughly match ${script.totalDurationSeconds} seconds. Include a scene for the hook and a scene for the payoff.`;

  const MAX_RETRIES = 3;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const scenes = await llm.generateJSON<ScenePlanWithKeywords[]>(SYSTEM_PROMPT, userPrompt);
      log("scene-plan", `Planned ${scenes.length} scenes`);
      return scenes;
    } catch (err: any) {
      lastError = err;
      log("scene-plan", `Attempt ${attempt}/${MAX_RETRIES} failed (${err.message}) — retrying...`);
    }
  }

  throw new Error(`Scene planning failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}
