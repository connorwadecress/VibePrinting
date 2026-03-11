import type {
  ChannelTheme,
  GenSecAssessment,
  PipelineStageBlueprint
} from "../domain/models.js";

export const recommendedTheme: ChannelTheme = {
  id: "compressed-curiosity",
  thesis:
    "Fast, story-shaped Shorts that turn surprising history, human performance, and everyday systems into memorable explanations.",
  description:
    "A single channel identity built from narrow repeatable lanes instead of fully random one-off facts.",
  publishSlots: ["11:00", "15:00", "19:00"],
  contentLanes: [
    {
      id: "history-flash",
      description: "Unexpected historical explanations with a reversal or contrast.",
      targetDurationSeconds: 40,
      exampleHooks: [
        "Why Roman concrete outlived modern buildings",
        "Why marathon distance is such a weird number"
      ]
    },
    {
      id: "human-limits",
      description: "What a benchmark means for the body in real life.",
      targetDurationSeconds: 35,
      exampleHooks: [
        "How fast the fastest humans actually move",
        "What running a marathon does to your body"
      ]
    },
    {
      id: "everyday-systems",
      description: "Simple explanations of invisible systems and mechanisms.",
      targetDurationSeconds: 35,
      exampleHooks: [
        "What turbulence actually is",
        "How GPS knows where you are"
      ]
    }
  ]
};

export const pipelineBlueprint: PipelineStageBlueprint[] = [
  {
    name: "topic-discovery",
    purpose: "Rank candidate topics inside approved lanes.",
    output: "TopicCandidate[]"
  },
  {
    name: "research-pack",
    purpose: "Build a compact source-backed fact pack for the selected topic.",
    output: "ResearchPack"
  },
  {
    name: "script-generation",
    purpose: "Write a short narrative with a hard hook and one clear payoff.",
    output: "ShortScript"
  },
  {
    name: "voiceover",
    purpose: "Render narration audio and timing marks.",
    output: "Narration audio asset"
  },
  {
    name: "scene-plan",
    purpose: "Translate story beats into scene-level prompts and captions.",
    output: "ScenePlan[]"
  },
  {
    name: "video-render",
    purpose: "Generate or collect the visual clips for each scene.",
    output: "Scene video assets"
  },
  {
    name: "assembly",
    purpose: "Compose final portrait short with captions and normalized audio.",
    output: "Final .mp4"
  },
  {
    name: "gensec-review",
    purpose: "Apply moderation, claim safety, likeness/IP, and disclosure rules.",
    output: "GenSecAssessment"
  },
  {
    name: "publish",
    purpose: "Upload, schedule, disclose synthetic media, and log analytics keys.",
    output: "PublishPackage"
  }
];

export const defaultGenSecAssessment: GenSecAssessment = {
  blockedReasons: [],
  disclosureRequired: true,
  riskLevel: "medium",
  safeToAutoPublish: false
};

export function describeBlueprint(): string {
  const lines: string[] = [];

  lines.push(`Theme: ${recommendedTheme.id}`);
  lines.push(`Thesis: ${recommendedTheme.thesis}`);
  lines.push("");
  lines.push("Publish slots:");
  for (const slot of recommendedTheme.publishSlots) {
    lines.push(`- ${slot}`);
  }

  lines.push("");
  lines.push("Content lanes:");
  for (const lane of recommendedTheme.contentLanes) {
    lines.push(`- ${lane.id}: ${lane.description}`);
  }

  lines.push("");
  lines.push("Pipeline:");
  for (const stage of pipelineBlueprint) {
    lines.push(`- ${stage.name}: ${stage.purpose} -> ${stage.output}`);
  }

  lines.push("");
  lines.push(
    "Default GenSec posture: disclosure required, medium risk by default, auto-publish disabled until shadow mode passes."
  );

  return lines.join("\n");
}

