import type {
  TopicCandidate,
  ResearchPack,
  ShortScript,
  ContentLane,
} from "../../domain/models.js";
import type { LlmClient } from "../../providers/llm.js";
import { log } from "../../utils/logger.js";

const SYSTEM_PROMPT = `You are a scriptwriter for YouTube Shorts. Write punchy, story-shaped scripts.

Rules:
- Hook must grab attention in the first 2 seconds. Start with a surprising claim or question.
- 4-6 beats, each with narration text and a visual intent description.
- Payoff delivers the "aha" moment.
- Call-to-action is a simple follow/like prompt.
- Total narration should be speakable in 30-45 seconds (~80-120 words).
- Write conversationally — as if explaining to a friend. No formal language.
- Every beat narration should be 1-2 sentences max.

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
  "totalDurationSeconds": number
}`;

export async function generateScript(
  llm: LlmClient,
  topic: TopicCandidate,
  research: ResearchPack,
  lane: ContentLane,
): Promise<ShortScript> {
  log("script", `Writing script for: "${topic.titleAngle}"`);

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

  const script = await llm.generateJSON<ShortScript>(SYSTEM_PROMPT, userPrompt);
  log("script", `Script: ${script.beats.length} beats, ~${script.totalDurationSeconds}s`);
  return script;
}
