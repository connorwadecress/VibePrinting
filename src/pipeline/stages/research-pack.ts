import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState, ResearchPack } from "../../domain/models.js";
import { log } from "../../utils/logger.js";

const SYSTEM_PROMPT = `You are a fact researcher for a YouTube Shorts channel.
Given a topic, produce a compact research pack with verified factual claims.
Each claim must have a confidence level and source attribution.

RESEARCH STRATEGY — fuel the curiosity gap:
- Lead with the most SURPRISING or counterintuitive claim — this is what the hook will tease.
- Include claims that build a progression of escalating surprise — each one should make the viewer think "wait, it gets crazier?"
- Save the most jaw-dropping or satisfying fact for last — this powers the climax/payoff.
- Concrete numbers, dates, and specifics are more compelling than vague statements.
- Look for reversals (things people assume are true but aren't) and hidden connections.

Respond with a JSON object:
{
  "topic": string,
  "summary": string (2-3 sentences),
  "claims": [
    {
      "claim": string,
      "confidence": "tentative" | "supported" | "strong",
      "sourceLabels": [string]
    }
  ]
}

Include 3-6 claims, ordered from hook-worthy to climax-worthy. Prefer "strong" claims with well-known sources (Wikipedia, established institutions, peer-reviewed research). Mark anything uncertain as "tentative."`;

export class ResearchPackStage implements PipelineStage {
  readonly name = "research-pack";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    const topic = state.topic;
    if (!topic) throw new Error("No topic in pipeline state");

    log(this.name, `Researching: "${topic.titleAngle}"`);

    const userPrompt = `Topic: "${topic.titleAngle}"
Seed question: ${topic.seedQuestion}
Lane: ${topic.laneId}

Build a research pack with factual claims that would support a 30-45 second YouTube Short about this topic.
Focus on the most surprising and concrete facts. Order claims so the most hook-worthy (attention-grabbing but doesn't give away the full story) comes first, and the most climax-worthy (the jaw-dropping payoff) comes last.`;

    const pack = await context.llm.generateJSON<ResearchPack>(SYSTEM_PROMPT, userPrompt);
    log(this.name, `Research complete: ${pack.claims.length} claims`);

    state.research = pack;
  }
}
