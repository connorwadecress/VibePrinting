import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { PipelineState, TopicCandidate } from "../../domain/models.js";
import { log } from "../../utils/logger.js";

const SYSTEM_PROMPT = `You are a topic researcher for a YouTube Shorts channel.
Your job is to generate a single novel, specific topic candidate for a given content lane.

CRITICAL — Curiosity gap principle:
Every viral short starts with a topic that creates an irresistible curiosity gap.
The topic MUST have a clear "answer" or "reveal" that can be WITHHELD until the end of the video.
If you can't imagine a viewer thinking "wait, really? I HAVE to find out" — the topic isn't strong enough.

Topic selection rules:
- The topic must surprise — look for reversals, contradictions, or "wait really?" moments.
- Think about the target audience: what do THEY want to see? What's already performing in this space?
- The answer/payoff must be worth waiting for — not obvious from the title alone.
- Prefer topics where the journey to the answer is as interesting as the answer itself.
- Avoid topics where the "hook" gives everything away — the viewer must need to watch to the end.
- Safe for general audiences.

Respond with a JSON object matching this schema:
{
  "laneId": string,
  "seedQuestion": string,
  "titleAngle": string,
  "noveltyScore": number (0-1),
  "riskLevel": "low" | "medium" | "high"
}`;

export class TopicDiscoveryStage implements PipelineStage {
  readonly name = "topic-discovery";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    if (state.topic) {
      log(this.name, `Resume: reusing topic "${state.topic.titleAngle}"`);
      return;
    }

    const lane = state.lane;
    if (!lane) throw new Error("No lane set in pipeline state");

    log(this.name, `Finding topic for lane: ${lane.id}`);

    let userPrompt = `Content lane: "${lane.id}"
Description: ${lane.description}
Target duration: ${lane.targetDurationSeconds} seconds
Example hooks from this lane: ${lane.exampleHooks.join("; ")}

Generate one fresh, specific topic that fits this lane. The topic should NOT be one of the examples above — find something new and surprising. Prefer topics with a clear reversal, contrast, or "wait really?" moment.`;

    const history = context.topicHistory;
    if (history && history.length > 0) {
      const recent = history.slice(-50);
      const historyBlock = recent
        .map((h) => `- [${h.laneId}] "${h.titleAngle}" (${h.seedQuestion})`)
        .join("\n");
      userPrompt += `\n\nRECENT TOPICS ALREADY COVERED (strongly avoid repeating these concepts or angles — find something genuinely different):\n${historyBlock}`;
    }

    const topic = await context.llm.generateJSON<TopicCandidate>(SYSTEM_PROMPT, userPrompt);
    log(this.name, `Topic: "${topic.titleAngle}" (novelty: ${topic.noveltyScore}, history: ${history?.length ?? 0} topics)`);

    state.topic = topic;
  }
}
