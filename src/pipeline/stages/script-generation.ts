import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState, ShortScript } from "../../domain/models.js";
import { log } from "../../utils/logger.js";

function buildSystemPrompt(targetSeconds: number): string {
  // ~2.3 spoken words per second at slightly-faster TTS rate.
  const minWords = Math.max(20, Math.round(targetSeconds * 2.0));
  const maxWords = Math.max(minWords + 5, Math.round(targetSeconds * 2.5));
  return `You are a scriptwriter for YouTube Shorts. Write punchy, story-shaped scripts using the HPC framework.

=== HPC FRAMEWORK (Hook → Progression → Climax) ===
Every viral short follows this three-act structure:

1. HOOK (first 2-5 seconds):
   - The single most important part of the video. STOP THE SCROLL.
   - Introduce the topic while leaving the viewer with MULTIPLE unanswered questions.
   - Use one of these proven techniques:
     • Shocking stat or reversal: "X% of people have no idea that..."
     • Direct challenge: "You've been doing X wrong your entire life."
     • Bold claim: "This single discovery changed everything we thought about X."
     • Open loop (create instant curiosity): "Scientists found something in X that nobody talks about."
     • Visceral image: Drop the viewer into a scene mid-action with urgent, specific language.
   - NEVER start with "In this video...", "Today we'll talk about...", "Have you ever wondered..." or any slow warm-up.
   - CRITICAL: Do NOT reveal the answer or payoff in the hook. The hook creates the question — the climax answers it.

2. PROGRESSION (beats — the middle):
   - Each beat advances the viewer toward the climax, building anticipation.
   - Show the JOURNEY, not just the result. Fulfill the promise made in the hook.
   - The content must match what the hook promised — never bait-and-switch.
   - Layer in surprising facts, tension, or mini-revelations that keep the viewer locked in.
   - Never pay off the main topic early. If the viewer gets what they came for mid-video, they scroll away.

3. CLIMAX (payoff — the end):
   - The moment the topic is fulfilled and the audience gets what they came for.
   - Place the big reveal, answer, or "aha" moment HERE — at the end, not the beginning or middle.
   - Make it satisfying — reward the viewer for watching all the way through.
   - Wrap up cleanly without dragging.

=== SCRIPT RULES ===
- 4-6 beats, each with narration text and a visual intent description.
- Call-to-action is a simple follow/like prompt.
- Total narration must be speakable in approximately ${targetSeconds} seconds. That means ${minWords}-${maxWords} words MAX. Count carefully — err short rather than long.
- Write conversationally — as if explaining to a friend. No formal language.
- Every beat narration should be 1-2 sentences max.

=== ANTI-PATTERNS (never do these) ===
- Paying off the topic in the first 5 seconds (kills retention instantly)
- Hook that gives away the answer (no reason to keep watching)
- Progression that doesn't match the hook's promise (bait-and-switch)
- Dragging on after the climax (lose the viewer on replays)
- Flat energy or long pauses in narration

=== PUBLISHING METADATA ===
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
}

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

Write a YouTube Short script using the HPC framework.
HOOK: Create an irresistible opening that leaves multiple unanswered questions — do NOT reveal the answer here.
PROGRESSION: Use the strongest research claims to build surprise and anticipation, advancing toward the reveal.
CLIMAX: Deliver the payoff at the END — the "aha" moment the viewer has been waiting for.
Remember: if the viewer gets the answer too early, they scroll away.`;

    const systemPrompt = buildSystemPrompt(lane.targetDurationSeconds);
    const script = await context.llm.generateJSON<ShortScript>(systemPrompt, userPrompt);
    log(this.name, `Script: ${script.beats.length} beats, ~${script.totalDurationSeconds}s`);

    state.script = script;
  }
}
