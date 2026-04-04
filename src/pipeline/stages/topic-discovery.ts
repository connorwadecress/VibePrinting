import type { TopicCandidate, ContentLane } from "../../domain/models.js";
import type { LlmClient } from "../../providers/llm.js";
import { log } from "../../utils/logger.js";

const SYSTEM_PROMPT = `You are a topic researcher for a YouTube Shorts channel called "Compressed Curiosity."
Your job is to generate a single novel, specific topic candidate for a given content lane.
The topic should be surprising, have a clear "hook" angle, and be safe for general audiences.

Respond with a JSON object matching this schema:
{
  "laneId": string,
  "seedQuestion": string,
  "titleAngle": string,
  "noveltyScore": number (0-1),
  "riskLevel": "low" | "medium" | "high"
}`;

export async function discoverTopic(
  llm: LlmClient,
  lane: ContentLane,
): Promise<TopicCandidate> {
  log("topic-discovery", `Finding topic for lane: ${lane.id}`);

  const userPrompt = `Content lane: "${lane.id}"
Description: ${lane.description}
Target duration: ${lane.targetDurationSeconds} seconds
Example hooks from this lane: ${lane.exampleHooks.join("; ")}

Generate one fresh, specific topic that fits this lane. The topic should NOT be one of the examples above — find something new and surprising. Prefer topics with a clear reversal, contrast, or "wait really?" moment.`;

  const topic = await llm.generateJSON<TopicCandidate>(SYSTEM_PROMPT, userPrompt);
  log("topic-discovery", `Topic: "${topic.titleAngle}" (novelty: ${topic.noveltyScore})`);
  return topic;
}
