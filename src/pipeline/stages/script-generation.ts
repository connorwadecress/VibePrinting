import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState, ShortScript } from "../../domain/models.js";
import { log } from "../../utils/logger.js";

const SYSTEM_PROMPT = `You are a scriptwriter for YouTube Shorts. Write punchy, story-shaped scripts.

Script rules:
- Hook must STOP THE SCROLL in the first 2 seconds. Use one of these proven techniques:
  • Shocking stat or reversal: "X% of people have no idea that..."
  • Direct challenge: "You've been doing X wrong your entire life."
  • Bold claim: "This single discovery changed everything we thought about X."
  • Open loop (create instant curiosity): "Scientists found something in X that nobody talks about."
  • Visceral image: Drop the viewer into a scene mid-action with urgent, specific language.
  NEVER start with "In this video...", "Today we'll talk about...", "Have you ever wondered..." or any slow warm-up. Jump straight in. The hook must create an itch the viewer HAS to scratch.
- 4-6 beats, each with narration text and a visual intent description.
- Payoff delivers the "aha" moment.
- Call-to-action is a simple follow/like prompt.
- Total narration must be speakable in 30-45 seconds. That means 55-80 words MAX. Count carefully — err short rather than long.
- Write conversationally — as if explaining to a friend. No formal language.
- Every beat narration should be 1-2 sentences max.

Publishing metadata rules:
- youtubeTitle: SEO-optimized, curiosity-driven, max 70 chars. NOT the hook — write a proper title.
- youtubeDescription: 3-5 sentences summarizing the video, then a line break, then "Key takeaways:" with 2-3 bullet points, then a subscribe CTA line.
- topicTags: 8-12 specific, searchable tags for this topic (e.g. "medieval history", "plague", "etymology"). Mix broad and niche.
- topicHashtags: 4-6 hashtags relevant to this specific topic (e.g. "#History", "#Etymology"). Always include "#Shorts".

Respond with JSON:
{
  "hook": string,
  "beats": [
    {
      "beatIndex": number,
      "narration": string,
      "visualIntent": string
    }
  ],
  "payoff": string,
  "callToAction": string,
  "totalDurationSeconds": number,
  "publishMeta": {
    "youtubeTitle": string,
    "youtubeDescription": string,
    "topicTags": string[],
    "topicHashtags": string[]
  }
}`;

export class ScriptGenerationStage implements PipelineStage {
  readonly name = "script-generation";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    const { topic, research, lane } = state;
    if (!topic) throw new Error("No topic in pipeline state");
    if (!research) throw new Error("No research in pipeline state");
    if (!lane) throw new Error("No lane in pipeline state");

    log(this.name, `Writing script for: "${topic.titleAngle}"`);

    const claimsList = research.claims
      .map((c) => `- ${c.claim} [${c.confidence}]`)
      .join("\n");

    const userPrompt = `Topic: "${topic.titleAngle}"
Lane: ${lane.id} (${lane.description})
Target duration: ${lane.targetDurationSeconds} seconds

Research claims:
${claimsList}

Summary: ${research.summary}

Write a YouTube Short script. Make the hook irresistible. Use the strongest research claims to build surprise. End with a satisfying payoff.`;

    const script = await context.llm.generateJSON<ShortScript>(SYSTEM_PROMPT, userPrompt);
    log(this.name, `Script: ${script.beats.length} beats, ~${script.totalDurationSeconds}s`);

    state.script = script;
  }
}
