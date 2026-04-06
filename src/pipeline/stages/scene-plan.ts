import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState, ScenePlanWithKeywords } from "../../domain/models.js";
import { log } from "../../utils/logger.js";

const SYSTEM_PROMPT = `You are a visual planner for YouTube Shorts. Convert script beats into scene plans with stock footage search keywords.

For each scene, provide:
- A visual description (what the viewer sees)
- Caption text to display on screen (short, punchy, max 8 words)
- Duration in seconds
- 2-3 stock footage search keywords for Pexels (specific, visual, searchable terms)

The first scene should be the hook. The last scene should be the payoff.
Never generate scenes with subscribe buttons, like buttons, notification bells, social media UI, or YouTube branding. Use real-world visuals only.

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

export class ScenePlanStage implements PipelineStage {
  readonly name = "scene-plan";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    const script = state.script;
    if (!script) throw new Error("No script in pipeline state");

    log(this.name, "Planning scenes...");

    const beatsText = script.beats
      .map((b) => `Beat ${b.beatIndex}: "${b.narration}" (Visual: ${b.visualIntent})`)
      .join("\n");

    const userPrompt = `Script:
Hook: "${script.hook}"
${beatsText}
Payoff: "${script.payoff}"
Total duration: ~${script.totalDurationSeconds} seconds

Plan scenes for this script. Ensure total scene durations roughly match ${script.totalDurationSeconds} seconds. Include a scene for the hook and a scene for the payoff. Use real-world stock footage keywords only.`;

    const MAX_RETRIES = 3;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const scenes = await context.llm.generateJSON<ScenePlanWithKeywords[]>(SYSTEM_PROMPT, userPrompt);
        log(this.name, `Planned ${scenes.length} scenes`);
        state.scenes = scenes;
        return;
      } catch (err: any) {
        lastError = err;
        log(this.name, `Attempt ${attempt}/${MAX_RETRIES} failed (${err.message}) — retrying...`);
      }
    }

    throw new Error(`Scene planning failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
  }
}
