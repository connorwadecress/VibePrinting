import type { LlmClient } from "../../domain/interfaces/llm-client.js";
import type {
  ResearchPack,
  ScenePlanWithKeywords,
  ShortScript,
  TopicCandidate,
} from "../../domain/models.js";

function extractLaneId(userPrompt: string): string {
  const match = userPrompt.match(/Content lane:\s*"([^"]+)"/i);
  return match?.[1] ?? "history-flash";
}

function buildTopic(laneId: string): TopicCandidate {
  const byLane: Record<string, { seedQuestion: string; titleAngle: string }> = {
    "history-flash": {
      seedQuestion: "Why did Roman concrete survive for thousands of years while modern concrete often cracks within decades?",
      titleAngle: "Why Roman concrete outlived modern buildings",
    },
    "design-on-purpose": {
      seedQuestion: "Why are stop signs octagons when circles and squares would be easier to make?",
      titleAngle: "The reason stop signs are octagons",
    },
    "why-that-rule": {
      seedQuestion: "Why are manhole covers round when most roads are made of straight lines?",
      titleAngle: "Why manhole covers are round",
    },
  };

  const picked = byLane[laneId] ?? byLane["history-flash"];
  return {
    laneId,
    seedQuestion: picked.seedQuestion,
    titleAngle: picked.titleAngle,
    noveltyScore: 0.82,
    riskLevel: "low",
  };
}

function buildResearch(topic: TopicCandidate): ResearchPack {
  return {
    topic: topic.titleAngle,
    summary: "Roman concrete got stronger over time because seawater triggered mineral growth inside tiny cracks. Modern mixes usually optimise for speed and cost instead of self-healing durability.",
    claims: [
      {
        claim: "Roman harbour concrete formed rare minerals when it reacted with seawater.",
        confidence: "strong",
        sourceLabels: ["MIT", "Science Advances"],
      },
      {
        claim: "Those minerals helped seal micro-cracks instead of letting them spread.",
        confidence: "supported",
        sourceLabels: ["MIT", "geology research"],
      },
      {
        claim: "Many modern concrete formulas prioritise fast curing and lower cost over ultra-long lifespan.",
        confidence: "supported",
        sourceLabels: ["civil engineering references"],
      },
      {
        claim: "That is why some Roman marine structures still exist after nearly two thousand years.",
        confidence: "strong",
        sourceLabels: ["archaeology surveys", "materials science"],
      },
    ],
  };
}

function buildScript(): ShortScript {
  return {
    hook: "Roman concrete did something modern concrete still struggles to do: it healed itself.",
    beats: [
      {
        beatIndex: 1,
        narration: "Some Roman harbours are still standing after nearly two thousand years.",
        visualIntent: "Ancient stone harbour walls taking waves in bright daylight.",
      },
      {
        beatIndex: 2,
        narration: "That makes no sense if concrete is supposed to crack and slowly die.",
        visualIntent: "Modern concrete surface splitting into visible cracks in close-up.",
      },
      {
        beatIndex: 3,
        narration: "But Roman builders used volcanic ash that reacted with seawater in a weird way.",
        visualIntent: "Volcanic ash and seawater mixing into a rough grey slurry.",
      },
      {
        beatIndex: 4,
        narration: "Inside tiny cracks, new minerals grew and stitched the structure back together.",
        visualIntent: "Microscopic crystal growth spreading through a cracked stone texture.",
      },
      {
        beatIndex: 5,
        narration: "So the punchline is brutal: the old recipe sometimes got stronger with damage.",
        visualIntent: "Split-screen of ancient Roman concrete versus crumbling modern concrete.",
      },
    ],
    payoff: "Roman concrete lasted because water triggered self-healing minerals instead of just erosion.",
    callToAction: "Follow for more hidden mechanics like this.",
    totalDurationSeconds: 38,
    publishMeta: {
      youtubeTitle: "Why Roman Concrete Outlived Modern Buildings",
      youtubeDescription: "Roman concrete was not just durable. In some marine structures, seawater actually helped create minerals that sealed cracks over time. That made some ancient builds absurdly resilient.\n\nKey takeaways:\n- Roman mixes used volcanic ash\n- Seawater triggered mineral growth\n- Some damage helped the material heal\n\nSubscribe for more short explainers.",
      topicTags: ["roman concrete", "ancient engineering", "materials science", "history shorts", "roman empire", "construction", "civil engineering", "self healing concrete"],
      topicHashtags: ["#History", "#Engineering", "#RomanEmpire", "#MaterialsScience", "#Shorts"],
    },
  };
}

function buildScenes(): ScenePlanWithKeywords[] {
  return [
    {
      sceneIndex: 1,
      prompt: "Wide cinematic shot of ancient Roman harbour ruins resisting crashing waves.",
      visualDescription: "Ancient stone harbour walls with seawater crashing against them.",
      captions: ["Roman concrete survived centuries"],
      seconds: 7,
      searchKeywords: ["ancient roman ruins sea", "stone harbour waves", "roman harbour", "coastal ruins", "ancient stone coast"],
    },
    {
      sceneIndex: 2,
      prompt: "Tight macro shot of a modern concrete slab showing deep spreading cracks.",
      visualDescription: "Close-up of cracked modern concrete surface in harsh light.",
      captions: ["Modern concrete just cracks"],
      seconds: 7,
      searchKeywords: ["cracked concrete close up", "broken cement texture", "damaged pavement", "concrete crack macro", "cement surface"],
    },
    {
      sceneIndex: 3,
      prompt: "Volcanic ash falling into water and mixing into grey slurry in a lab-style setup.",
      visualDescription: "Grey volcanic ash mixing with water in a container.",
      captions: ["The mix was different"],
      seconds: 8,
      searchKeywords: ["volcanic ash water", "ash mixing slurry", "grey mineral mixture", "powder in water", "lab mixing material"],
    },
    {
      sceneIndex: 4,
      prompt: "Microscopic crystal structures growing through a crack like natural stitching.",
      visualDescription: "Crystal-like mineral growth spreading inside a narrow crack.",
      captions: ["Cracks started healing"],
      seconds: 8,
      searchKeywords: ["crystal growth macro", "mineral formation close up", "microscopic crystals", "rock crystal texture", "geology macro"],
    },
    {
      sceneIndex: 5,
      prompt: "Split-screen comparison of durable Roman stone and failing modern concrete in urban space.",
      visualDescription: "Side-by-side contrast between ancient stone structure and crumbling concrete.",
      captions: ["Damage made it stronger"],
      seconds: 8,
      searchKeywords: ["ancient stone wall", "crumbling concrete building", "old vs new building", "weathered stone", "urban concrete damage"],
    },
  ];
}

export class MockLlmClient implements LlmClient {
  async generateJSON<T>(systemPrompt: string, userPrompt: string): Promise<T> {
    const prompt = `${systemPrompt}\n${userPrompt}`.toLowerCase();

    if (prompt.includes("topic researcher") || prompt.includes("content lane:")) {
      return buildTopic(extractLaneId(userPrompt)) as T;
    }

    if (prompt.includes("fact researcher") || prompt.includes('"claims": [')) {
      return buildResearch(buildTopic(extractLaneId(userPrompt))) as T;
    }

    if (prompt.includes("scriptwriter for youtube shorts") || prompt.includes('"hook": string')) {
      return buildScript() as T;
    }

    if (prompt.includes("visual planner for youtube shorts") || prompt.includes('respond with json array')) {
      return buildScenes() as T;
    }

    throw new Error(`MockLlmClient has no fixture for prompt: ${systemPrompt.slice(0, 80)}`);
  }
}
