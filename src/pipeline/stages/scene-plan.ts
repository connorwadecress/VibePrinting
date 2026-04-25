import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState, ScenePlanWithKeywords } from "../../domain/models.js";
import { log } from "../../utils/logger.js";
import { writeScenes } from "../../utils/run-resume.js";

const SYSTEM_PROMPT = `You are a visual planner for YouTube Shorts. Convert script beats into scene plans with stock footage search keywords.

=== PACING & RETENTION RULES ===
- Fast-paced visuals with ZERO dead air — every second must have visual movement or change.
- Captions must be on screen at ALL times during narration. Short, punchy, max 8 words per caption.
- Quick cuts between scenes keep attention — no single clip should overstay its welcome.
- The hook scene must be the most visually striking and attention-grabbing.
- Visual energy should build through progression and peak at the climax/payoff scene.
- Match visual pacing to narration energy — when narration builds tension, visuals should intensify.

For each scene, provide:
- A creative visual direction (what the viewer sees)
- A visualDescription: a plain-English sentence describing what the ideal stock footage clip looks like (e.g. "A close-up of a bubbling beaker in a dimly lit laboratory")
- Caption text to display on screen (short, punchy, max 8 words)
- Duration in seconds
- 4-5 stock footage search keywords for Pexels, ranked from most specific to broadest fallback

CRITICAL — Keyword rules:
- Each scene's keywords must match what the viewer literally SEES during that specific narration moment, NOT the overall topic.
  Example: If narration says "ancient Romans used lead pipes" → keywords should be "ancient roman aqueduct", "lead water pipes closeup", "roman stone ruins", "old stone tunnel", "underground pipes" — NOT "history" or "Rome skyline".
- Every keyword must be concrete and visual — something a stock video site would have real footage of.
- Avoid generic/abstract keywords like "concept", "idea", "history", "science", "technology", "information", "future". These return random, irrelevant footage.
- Rank keywords from most specific (best match for this exact moment) to broadest (backup if specific ones return no results).

The first scene should be the hook. The last scene should be the payoff.
Never generate scenes with subscribe buttons, like buttons, notification bells, social media UI, or YouTube branding. Use real-world visuals only.

Respond with JSON array:
[
  {
    "sceneIndex": number,
    "prompt": string (creative visual direction),
    "visualDescription": string (plain-English description of ideal stock clip),
    "captions": [string],
    "seconds": number,
    "searchKeywords": [string] (4-5 keywords, most specific first)
  }
]`;

export class ScenePlanStage implements PipelineStage {
  readonly name = "scene-plan";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    if (state.scenes && state.scenes.length > 0) {
      log(this.name, `Resume: reusing ${state.scenes.length} scenes`);
      return;
    }

    const script = state.script;
    if (!script) throw new Error("No script in pipeline state");

    log(this.name, "Planning scenes...");

    const beatsText = script.beats
      .map(
        (b) =>
          `Beat ${b.beatIndex}:\n  Narration (what the viewer HEARS): "${b.narration}"\n  Visual intent (what the viewer SEES): "${b.visualIntent}"`,
      )
      .join("\n\n");

    const userPrompt = `Script:
Hook: "${script.hook}"

${beatsText}

Payoff: "${script.payoff}"
Total duration: ~${script.totalDurationSeconds} seconds

Plan scenes for this script. Ensure total scene durations roughly match ${script.totalDurationSeconds} seconds. Include a scene for the hook and a scene for the payoff. For each scene, think about what SPECIFIC real-world footage would visually reinforce what the viewer is hearing at that exact moment.`;

    const MAX_RETRIES = 3;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const scenes = await context.llm.generateJSON<ScenePlanWithKeywords[]>(SYSTEM_PROMPT, userPrompt);
        log(this.name, `Planned ${scenes.length} scenes`);
        state.scenes = scenes;
        writeScenes(context.workDir, scenes);
        return;
      } catch (err: any) {
        lastError = err;
        log(this.name, `Attempt ${attempt}/${MAX_RETRIES} failed (${err.message}) — retrying...`);
      }
    }

    throw new Error(`Scene planning failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
  }
}
