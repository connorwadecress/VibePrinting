import type { N8nWorkflowDefinition } from "./api.js";

interface WorkflowAsset {
  fileName: string;
  workflow: N8nWorkflowDefinition;
}

function createWebhookWorkflow(options: {
  name: string;
  description: string;
  path: string;
  webhookId: string;
  code: string;
  active?: boolean;
  availableInMcp?: boolean;
}): N8nWorkflowDefinition {
  const receiveName = "Receive Request";
  const runName = "Run Workflow Logic";
  const respondName = "Return Response";

  return {
    name: options.name,
    description: options.description,
    active: options.active ?? true,
    settings: {
      executionOrder: "v1",
      availableInMCP: options.availableInMcp ?? true
    },
    nodes: [
      {
        id: "0a5b9c47-2912-4a4d-a8b6-bdff9b302aa1",
        name: receiveName,
        type: "n8n-nodes-base.webhook",
        typeVersion: 2.1,
        position: [-280, 0],
        onError: "continueRegularOutput",
        webhookId: options.webhookId,
        parameters: {
          httpMethod: "POST",
          path: options.path,
          responseMode: "responseNode",
          options: {}
        }
      },
      {
        id: "3f21f215-f43f-46fd-a993-6e1d2424063f",
        name: runName,
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [20, 0],
        parameters: {
          mode: "runOnceForAllItems",
          jsCode: options.code
        }
      },
      {
        id: "d5682eaf-84ab-4622-92f8-fd4534aec7e2",
        name: respondName,
        type: "n8n-nodes-base.respondToWebhook",
        typeVersion: 1.4,
        position: [320, 0],
        parameters: {
          options: {}
        }
      }
    ],
    connections: {
      [receiveName]: {
        main: [[{ node: runName, type: "main", index: 0 }]]
      },
      [runName]: {
        main: [[{ node: respondName, type: "main", index: 0 }]]
      }
    }
  };
}

const researchPackBuilderCode = String.raw`const body = $input.first().json.body ?? {};

const normalizeText = (value) => String(value ?? '').trim();
const slugify = (value) => normalizeText(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

const topic = body.topic ?? body.selectedTopic ?? null;

if (!topic || typeof topic !== 'object') {
  return [{
    json: {
      success: false,
      error: 'A topic object is required.',
      example: {
        topic: {
          topicId: 'history-flash-why-the-marathon-is-such-a-strange-distance',
          laneId: 'history-flash',
          titleAngle: 'Why the marathon is such a strange distance',
          seedQuestion: 'Why is a marathon 26.2 miles instead of a clean round number?',
          draftHook: 'The marathon distance exists because one royal family wanted a better view.'
        }
      }
    }
  }];
}

const titleAngle = normalizeText(topic.titleAngle);
const seedQuestion = normalizeText(topic.seedQuestion);
const laneLabel = normalizeText(topic.laneLabel);
const topicId = normalizeText(topic.topicId) || slugify(titleAngle || 'untitled-topic');

if (!titleAngle) {
  return [{
    json: {
      success: false,
      error: 'topic.titleAngle is required.'
    }
  }];
}

const seededCatalog = {
  'why-roman-concrete-survived-for-centuries': {
    summary: 'Roman concrete remained durable because ancient builders used volcanic ash and lime in ways that allowed the material to keep reacting over time.',
    sources: [
      {
        title: 'Roman concrete',
        description: 'Overview of Roman pozzolanic concrete and its long-term durability.',
        extract: 'Roman concrete used volcanic ash, lime, and aggregate in a mix that helped marine structures stay durable for centuries.',
        url: 'https://en.wikipedia.org/wiki/Roman_concrete',
        sourceType: 'seeded-reference'
      }
    ]
  },
  'why-the-marathon-is-such-a-strange-distance': {
    summary: 'The marathon distance became fixed after the 1908 London Olympic route, and the international standard later locked in 26 miles 385 yards.',
    sources: [
      {
        title: 'Marathon',
        description: 'Historical explanation of how the modern marathon distance was standardized.',
        extract: 'The marathon was standardized at 42.195 kilometres after the 1908 London Olympics and was later adopted internationally.',
        url: 'https://en.wikipedia.org/wiki/Marathon',
        sourceType: 'seeded-reference'
      }
    ]
  },
  'how-ancient-armies-moved-faster-than-most-people-think': {
    summary: 'Ancient armies could move surprisingly quickly when logistics, road networks, and marching discipline aligned.',
    sources: [
      {
        title: 'Roman army',
        description: 'Roman military organization and march discipline.',
        extract: 'Roman armies combined engineering, marching discipline, and road networks to move and resupply efficiently over long distances.',
        url: 'https://en.wikipedia.org/wiki/Roman_army',
        sourceType: 'seeded-reference'
      }
    ]
  },
  'how-fast-elite-sprinters-really-move': {
    summary: 'Elite sprinters reach top speeds that are far beyond everyday running pace, but only for very short windows.',
    sources: [
      {
        title: '100 metres',
        description: 'Benchmark sprint event used to compare elite human speed.',
        extract: 'The 100 metres is the standard benchmark for maximal sprinting speed and highlights how quickly elite athletes accelerate and fade.',
        url: 'https://en.wikipedia.org/wiki/100_metres',
        sourceType: 'seeded-reference'
      }
    ]
  },
  'what-turbulence-really-is': {
    summary: 'Turbulence is irregular air movement created by shifting wind, terrain, temperature, storms, or wake from other aircraft.',
    sources: [
      {
        title: 'Turbulence',
        description: 'Overview of turbulent flow in fluids and air.',
        extract: 'Turbulence is irregular, chaotic fluid motion that appears when air flow breaks into eddies and rapid directional changes.',
        url: 'https://en.wikipedia.org/wiki/Turbulence',
        sourceType: 'seeded-reference'
      }
    ]
  },
  'why-microwaves-heat-food-unevenly': {
    summary: 'Microwave heating varies because energy distribution, geometry, and moisture content do not stay uniform across the dish.',
    sources: [
      {
        title: 'Microwave oven',
        description: 'How microwave ovens heat food and why heating can be uneven.',
        extract: 'Microwave ovens heat food by exciting water molecules, but standing waves and uneven energy distribution create hot and cold spots.',
        url: 'https://en.wikipedia.org/wiki/Microwave_oven',
        sourceType: 'seeded-reference'
      }
    ]
  },
  'how-gps-finds-you-so-precisely': {
    summary: 'GPS works by comparing timing signals from multiple satellites and solving for position using those time differences.',
    sources: [
      {
        title: 'Global Positioning System',
        description: 'Overview of how GPS uses satellite timing for location.',
        extract: 'GPS determines location by comparing signals from satellites and solving a timing problem that reveals distance from each one.',
        url: 'https://en.wikipedia.org/wiki/Global_Positioning_System',
        sourceType: 'seeded-reference'
      }
    ]
  }
};

const key = slugify(titleAngle);
const seededEntry = seededCatalog[key];

const sources = seededEntry?.sources ?? [{
  title: 'Seed topic brief',
  description: 'Fallback placeholder for topics that still need a verified source pass.',
  extract: seedQuestion || titleAngle,
  url: '',
  sourceType: 'seeded-placeholder'
}];

const claims = sources.slice(0, 3).map((source, index) => ({
  claim: source.extract,
  confidence: Number(((source.sourceType === 'seeded-reference' ? 0.72 : 0.42) - (index * 0.04)).toFixed(2)),
  sourceLabels: [source.title]
}));

return [{
  json: {
    success: true,
    workflow: 'vibe-printing-research-pack-builder',
    generatedAt: new Date().toISOString(),
    researchMode: seededEntry ? 'seeded-offline-reference' : 'seeded-placeholder',
    topic: {
      ...topic,
      topicId
    },
    researchQueries: [
      titleAngle,
      seedQuestion,
      [laneLabel, titleAngle].filter(Boolean).join(' ')
    ].filter(Boolean),
    sources,
    claims,
    summary: seededEntry?.summary
      ?? 'This topic still needs a verified source pass. The current pack preserves the angle, research prompts, and a placeholder claim for downstream dry runs.',
    verificationChecklist: [
      'Confirm each claim against a primary or trusted secondary source before publishing.',
      'Replace any seeded-placeholder source before a real upload workflow is connected.',
      'Keep the storageRecord key and update the same topic once verified research is available.'
    ],
    storageRecord: {
      storageMode: 'execution-log',
      table: 'researchPacks',
      recordKey: topicId + '-' + new Date().toISOString().slice(0, 10)
    },
    nextStepSuggestion: 'Pass this full response to the short-script-generator workflow.'
  }
}];`;

const shortScriptGeneratorCode = String.raw`const body = $input.first().json.body ?? {};

const normalizeText = (value) => String(value ?? '').trim();
const clamp = (value, min, max) => {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
};
const lowerFirst = (value) => value.length === 0 ? value : value.charAt(0).toLowerCase() + value.slice(1);

const researchPack = body.researchPack ?? body.research ?? null;
const topic = body.topic ?? researchPack?.topic ?? null;

if (!topic || typeof topic !== 'object') {
  return [{
    json: {
      success: false,
      error: 'A topic object is required.'
    }
  }];
}

if (!researchPack || typeof researchPack !== 'object') {
  return [{
    json: {
      success: false,
      error: 'A researchPack object is required.'
    }
  }];
}

const titleAngle = normalizeText(topic.titleAngle);
const seedQuestion = normalizeText(topic.seedQuestion);
const hook = normalizeText(topic.draftHook) || 'Most people miss the real reason this happens.';
const targetDurationSeconds = clamp(Number(body.targetDurationSeconds ?? 38), 30, 50);
const claims = Array.isArray(researchPack.claims) ? researchPack.claims : [];
const topClaim = normalizeText(claims[0]?.claim) || normalizeText(researchPack.summary) || seedQuestion;
const supportClaim = normalizeText(claims[1]?.claim) || topClaim;
const titleAngleStem = titleAngle.replace(/\?$/, '');
const payoffLine = /^why\s+/i.test(titleAngleStem)
  ? 'That is because ' + lowerFirst(titleAngleStem.replace(/^why\s+/i, '')) + '.'
  : 'That is why ' + lowerFirst(titleAngleStem) + '.';

const beats = [
  {
    beatIndex: 1,
    narration: hook,
    visualIntent: 'Cold open with a hard contrast image and oversized motion text.'
  },
  {
    beatIndex: 2,
    narration: 'The question is simple: ' + seedQuestion,
    visualIntent: 'Introduce the problem with a familiar visual or one-line setup.'
  },
  {
    beatIndex: 3,
    narration: topClaim,
    visualIntent: 'Reveal the main mechanism with kinetic text and one supporting visual.'
  },
  {
    beatIndex: 4,
    narration: supportClaim,
    visualIntent: 'Layer in one extra detail that makes the fact feel memorable.'
  },
  {
    beatIndex: 5,
    narration: payoffLine + ' Follow for more compressed curiosity.',
    visualIntent: 'Resolve with the payoff line and a short branded end card.'
  }
];

const titleOptions = [
  titleAngle,
  'The real reason ' + lowerFirst(titleAngle.replace(/\?$/, '')),
  'Explained fast: ' + titleAngle
];

return [{
  json: {
    success: true,
    workflow: 'vibe-printing-short-script-generator',
    generatedAt: new Date().toISOString(),
    topic,
    researchPack,
    shortScript: {
      hook,
      payoff: payoffLine,
      callToAction: 'Follow for more compressed curiosity.',
      totalDurationSeconds: targetDurationSeconds,
      beats
    },
    metadataPack: {
      titleOptions,
      descriptionDraft: titleAngle + '. AI-assisted research and writing draft pending fact check before publish.',
      tags: ['shorts', 'history', 'science', 'curiosity', String(topic.laneId ?? 'vibe-printing')],
      disclosureRequired: true,
      operatorMode: topic.riskLevel === 'medium' ? 'review-required' : 'shadow-review'
    },
    nextStepSuggestion: 'Pass shortScript and metadataPack to the production-packet-builder workflow.'
  }
}];`;

const productionPacketBuilderCode = String.raw`const body = $input.first().json.body ?? {};

const normalizeText = (value) => String(value ?? '').trim();
const clamp = (value, min, max) => {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
};

const topic = body.topic ?? body.researchPack?.topic ?? null;
const shortScript = body.shortScript ?? body.script ?? null;
const metadataPack = body.metadataPack ?? null;

if (!topic || typeof topic !== 'object') {
  return [{
    json: {
      success: false,
      error: 'A topic object is required.'
    }
  }];
}

if (!shortScript || typeof shortScript !== 'object') {
  return [{
    json: {
      success: false,
      error: 'A shortScript object is required.'
    }
  }];
}

const beats = Array.isArray(shortScript.beats) ? shortScript.beats : [];
if (beats.length === 0) {
  return [{
    json: {
      success: false,
      error: 'shortScript.beats must contain at least one beat.'
    }
  }];
}

const totalDurationSeconds = clamp(Number(shortScript.totalDurationSeconds ?? 38), 30, 60);
const secondsPerBeat = Math.max(4, Math.floor(totalDurationSeconds / beats.length));

const scenePlan = beats.map((beat, index) => ({
  sceneIndex: index + 1,
  seconds: secondsPerBeat,
  prompt: 'Vertical cinematic explainer visual for "' + normalizeText(topic.titleAngle) + '". ' + normalizeText(beat.visualIntent) + ' Clean background, high contrast, no burned-in text.',
  captions: [normalizeText(beat.narration)]
}));

const voiceoverPlan = {
  provider: 'openai-tts-or-manual',
  mode: 'dry-run',
  voice: 'alloy',
  style: 'curious, confident, fast but clear',
  segments: beats.map((beat, index) => ({
    segmentIndex: index + 1,
    startSecond: index * secondsPerBeat,
    durationSeconds: secondsPerBeat,
    text: normalizeText(beat.narration)
  })),
  estimatedCharacters: beats.reduce((total, beat) => total + normalizeText(beat.narration).length, 0)
};

const videoPlan = {
  provider: 'sora-or-stock-footage',
  mode: 'dry-run',
  aspectRatio: '9:16',
  shots: scenePlan.map((scene) => ({
    sceneIndex: scene.sceneIndex,
    prompt: scene.prompt,
    targetSeconds: scene.seconds,
    fallback: 'Use stock footage plus motion graphics if a model render is unavailable.'
  }))
};

const descriptionDraft = normalizeText(metadataPack?.descriptionDraft)
  || normalizeText(topic.titleAngle) + '. AI-assisted script and production draft pending review.';

return [{
  json: {
    success: true,
    workflow: 'vibe-printing-production-packet-builder',
    generatedAt: new Date().toISOString(),
    topic,
    shortScript,
    scenePlan,
    voiceoverPlan,
    videoPlan,
    assemblyManifest: {
      format: 'mp4',
      resolution: '1080x1920',
      frameRate: 30,
      captionsMode: 'burned-in',
      scenes: scenePlan,
      audioMix: {
        narration: 'primary',
        musicBed: 'optional-low',
        loudnessTarget: '-14 LUFS'
      }
    },
    publishPackage: {
      title: normalizeText(metadataPack?.titleOptions?.[0]) || normalizeText(topic.titleAngle),
      description: descriptionDraft,
      tags: Array.isArray(metadataPack?.tags) ? metadataPack.tags : ['shorts', 'vibe-printing'],
      scheduledSlot: normalizeText(topic.publishSlot) || '11:00',
      disclosureRequired: metadataPack?.disclosureRequired !== false
    },
    operatorChecklist: [
      'Swap dry-run voiceoverPlan for a real TTS call once credits are available.',
      'Swap dry-run videoPlan for real renders or stock footage collection.',
      'Do one final factual and disclosure review before any upload workflow is connected.'
    ],
    nextStepSuggestion: 'Use this packet as the handoff contract to real voice, video, and publishing workflows.'
  }
}];`;

const dryRunPipelineCode = String.raw`const body = $input.first().json.body ?? {};

const normalizeText = (value) => String(value ?? '').trim();
const clamp = (value, min, max) => {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.floor(value)));
};
const slugify = (value) => normalizeText(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');
const lowerFirst = (value) => value.length === 0 ? value : value.charAt(0).toLowerCase() + value.slice(1);

const laneCatalog = [
  {
    id: 'history-flash',
    label: 'History flash',
    angles: [
      {
        titleAngle: 'Why Roman concrete survived for centuries',
        seedQuestion: 'Why is Roman concrete still standing when modern concrete often cracks much faster?',
        draftHook: 'Roman concrete had a flaw that made it harder to destroy.',
        riskLevel: 'low'
      },
      {
        titleAngle: 'Why the marathon is such a strange distance',
        seedQuestion: 'Why is a marathon 26.2 miles instead of a clean round number?',
        draftHook: 'The marathon distance exists because one royal family wanted a better view.',
        riskLevel: 'low'
      },
      {
        titleAngle: 'How ancient armies moved faster than most people think',
        seedQuestion: 'How did premodern armies cover distance without engines or modern logistics?',
        draftHook: 'Ancient armies were slow until you look at what they did every single day.',
        riskLevel: 'low'
      }
    ]
  },
  {
    id: 'human-limits',
    label: 'Human limits',
    angles: [
      {
        titleAngle: 'How fast elite sprinters really move',
        seedQuestion: 'What does world-class sprint speed actually look like in everyday terms?',
        draftHook: 'At top speed, elite sprinters are moving faster than most people can process in real time.',
        riskLevel: 'low'
      },
      {
        titleAngle: 'What a marathon does to the body',
        seedQuestion: 'What changes inside the body during and after marathon effort?',
        draftHook: 'A marathon does not just make you tired. It forces your whole body into negotiation mode.',
        riskLevel: 'medium'
      }
    ]
  },
  {
    id: 'everyday-systems',
    label: 'Everyday systems',
    angles: [
      {
        titleAngle: 'What turbulence really is',
        seedQuestion: 'Why does smooth air suddenly turn rough even when the sky looks calm?',
        draftHook: 'Turbulence feels random from a seat, but the air has a reason every time.',
        riskLevel: 'low'
      },
      {
        titleAngle: 'Why microwaves heat food unevenly',
        seedQuestion: 'Why do some parts of a meal turn boiling while others stay cold?',
        draftHook: 'Your microwave is not broken. It is exposing how energy and geometry fight each other.',
        riskLevel: 'low'
      },
      {
        titleAngle: 'How GPS finds you so precisely',
        seedQuestion: 'How does a phone turn satellite timing into a location dot?',
        draftHook: 'GPS works because your phone solves a timing puzzle at absurd speed.',
        riskLevel: 'low'
      }
    ]
  }
];

const seededCatalog = {
  'why-roman-concrete-survived-for-centuries': {
    summary: 'Roman concrete remained durable because ancient builders used volcanic ash and lime in ways that allowed the material to keep reacting over time.',
    sources: [{
      title: 'Roman concrete',
      description: 'Overview of Roman pozzolanic concrete and its long-term durability.',
      extract: 'Roman concrete used volcanic ash, lime, and aggregate in a mix that helped marine structures stay durable for centuries.',
      url: 'https://en.wikipedia.org/wiki/Roman_concrete',
      sourceType: 'seeded-reference'
    }]
  },
  'why-the-marathon-is-such-a-strange-distance': {
    summary: 'The marathon distance became fixed after the 1908 London Olympic route, and the international standard later locked in 26 miles 385 yards.',
    sources: [{
      title: 'Marathon',
      description: 'Historical explanation of how the modern marathon distance was standardized.',
      extract: 'The marathon was standardized at 42.195 kilometres after the 1908 London Olympics and was later adopted internationally.',
      url: 'https://en.wikipedia.org/wiki/Marathon',
      sourceType: 'seeded-reference'
    }]
  },
  'what-turbulence-really-is': {
    summary: 'Turbulence is irregular air movement created by shifting wind, terrain, temperature, storms, or wake from other aircraft.',
    sources: [{
      title: 'Turbulence',
      description: 'Overview of turbulent flow in fluids and air.',
      extract: 'Turbulence is irregular, chaotic fluid motion that appears when air flow breaks into eddies and rapid directional changes.',
      url: 'https://en.wikipedia.org/wiki/Turbulence',
      sourceType: 'seeded-reference'
    }]
  },
  'why-microwaves-heat-food-unevenly': {
    summary: 'Microwave heating varies because energy distribution, geometry, and moisture content do not stay uniform across the dish.',
    sources: [{
      title: 'Microwave oven',
      description: 'How microwave ovens heat food and why heating can be uneven.',
      extract: 'Microwave ovens heat food by exciting water molecules, but standing waves and uneven energy distribution create hot and cold spots.',
      url: 'https://en.wikipedia.org/wiki/Microwave_oven',
      sourceType: 'seeded-reference'
    }]
  },
  'how-gps-finds-you-so-precisely': {
    summary: 'GPS works by comparing timing signals from multiple satellites and solving for position using those time differences.',
    sources: [{
      title: 'Global Positioning System',
      description: 'Overview of how GPS uses satellite timing for location.',
      extract: 'GPS determines location by comparing signals from satellites and solving a timing problem that reveals distance from each one.',
      url: 'https://en.wikipedia.org/wiki/Global_Positioning_System',
      sourceType: 'seeded-reference'
    }]
  }
};

const buildResearchPack = (topic) => {
  const titleAngle = normalizeText(topic.titleAngle);
  const key = slugify(titleAngle);
  const seededEntry = seededCatalog[key];
  const sources = seededEntry?.sources ?? [{
    title: 'Seed topic brief',
    description: 'Fallback placeholder for topics that still need a verified source pass.',
    extract: normalizeText(topic.seedQuestion) || titleAngle,
    url: '',
    sourceType: 'seeded-placeholder'
  }];

  return {
    success: true,
    workflow: 'vibe-printing-research-pack-builder',
    generatedAt: new Date().toISOString(),
    researchMode: seededEntry ? 'seeded-offline-reference' : 'seeded-placeholder',
    topic,
    researchQueries: [
      titleAngle,
      normalizeText(topic.seedQuestion),
      [normalizeText(topic.laneLabel), titleAngle].filter(Boolean).join(' ')
    ].filter(Boolean),
    sources,
    claims: sources.slice(0, 3).map((source, index) => ({
      claim: source.extract,
      confidence: Number(((source.sourceType === 'seeded-reference' ? 0.72 : 0.42) - (index * 0.04)).toFixed(2)),
      sourceLabels: [source.title]
    })),
    summary: seededEntry?.summary
      ?? 'This topic still needs a verified source pass. The current pack preserves the angle, research prompts, and a placeholder claim for downstream dry runs.',
    storageRecord: {
      storageMode: 'execution-log',
      table: 'researchPacks',
      recordKey: normalizeText(topic.topicId) + '-' + new Date().toISOString().slice(0, 10)
    }
  };
};

const buildScriptPack = (topic, researchPack) => {
  const hook = normalizeText(topic.draftHook) || 'Most people miss the real reason this happens.';
  const topClaim = normalizeText(researchPack.claims?.[0]?.claim) || normalizeText(researchPack.summary) || normalizeText(topic.seedQuestion);
  const supportClaim = normalizeText(researchPack.claims?.[1]?.claim) || topClaim;
  const titleAngleStem = normalizeText(topic.titleAngle).replace(/\?$/, '');
  const payoffLine = /^why\s+/i.test(titleAngleStem)
    ? 'That is because ' + lowerFirst(titleAngleStem.replace(/^why\s+/i, '')) + '.'
    : 'That is why ' + lowerFirst(titleAngleStem) + '.';
  const beats = [
    {
      beatIndex: 1,
      narration: hook,
      visualIntent: 'Cold open with a hard contrast image and oversized motion text.'
    },
    {
      beatIndex: 2,
      narration: 'The question is simple: ' + normalizeText(topic.seedQuestion),
      visualIntent: 'Introduce the problem with a familiar visual or one-line setup.'
    },
    {
      beatIndex: 3,
      narration: topClaim,
      visualIntent: 'Reveal the main mechanism with kinetic text and one supporting visual.'
    },
    {
      beatIndex: 4,
      narration: supportClaim,
      visualIntent: 'Layer in one extra detail that makes the fact feel memorable.'
    },
    {
      beatIndex: 5,
      narration: payoffLine + ' Follow for more compressed curiosity.',
      visualIntent: 'Resolve with the payoff line and a short branded end card.'
    }
  ];

  return {
    success: true,
    workflow: 'vibe-printing-short-script-generator',
    generatedAt: new Date().toISOString(),
    topic,
    researchPack,
    shortScript: {
      hook,
      payoff: payoffLine,
      callToAction: 'Follow for more compressed curiosity.',
      totalDurationSeconds: 38,
      beats
    },
    metadataPack: {
      titleOptions: [
        normalizeText(topic.titleAngle),
        'The real reason ' + lowerFirst(normalizeText(topic.titleAngle).replace(/\?$/, '')),
        'Explained fast: ' + normalizeText(topic.titleAngle)
      ],
      descriptionDraft: normalizeText(topic.titleAngle) + '. AI-assisted research and writing draft pending fact check before publish.',
      tags: ['shorts', 'history', 'science', 'curiosity', String(topic.laneId ?? 'vibe-printing')],
      disclosureRequired: true,
      operatorMode: topic.riskLevel === 'medium' ? 'review-required' : 'shadow-review'
    }
  };
};

const buildProductionPacket = (topic, shortScript, metadataPack) => {
  const beats = Array.isArray(shortScript.beats) ? shortScript.beats : [];
  const secondsPerBeat = Math.max(4, Math.floor(38 / Math.max(beats.length, 1)));
  const scenePlan = beats.map((beat, index) => ({
    sceneIndex: index + 1,
    seconds: secondsPerBeat,
    prompt: 'Vertical cinematic explainer visual for "' + normalizeText(topic.titleAngle) + '". ' + normalizeText(beat.visualIntent) + ' Clean background, high contrast, no burned-in text.',
    captions: [normalizeText(beat.narration)]
  }));

  return {
    success: true,
    workflow: 'vibe-printing-production-packet-builder',
    generatedAt: new Date().toISOString(),
    topic,
    shortScript,
    scenePlan,
    voiceoverPlan: {
      provider: 'openai-tts-or-manual',
      mode: 'dry-run',
      voice: 'alloy',
      style: 'curious, confident, fast but clear',
      segments: beats.map((beat, index) => ({
        segmentIndex: index + 1,
        startSecond: index * secondsPerBeat,
        durationSeconds: secondsPerBeat,
        text: normalizeText(beat.narration)
      }))
    },
    videoPlan: {
      provider: 'sora-or-stock-footage',
      mode: 'dry-run',
      aspectRatio: '9:16',
      shots: scenePlan.map((scene) => ({
        sceneIndex: scene.sceneIndex,
        prompt: scene.prompt,
        targetSeconds: scene.seconds,
        fallback: 'Use stock footage plus motion graphics if a model render is unavailable.'
      }))
    },
    publishPackage: {
      title: normalizeText(metadataPack.titleOptions?.[0]) || normalizeText(topic.titleAngle),
      description: normalizeText(metadataPack.descriptionDraft),
      tags: Array.isArray(metadataPack.tags) ? metadataPack.tags : ['shorts', 'vibe-printing'],
      scheduledSlot: normalizeText(topic.publishSlot) || '11:00',
      disclosureRequired: metadataPack.disclosureRequired !== false
    }
  };
};

const requestedLaneIds = Array.isArray(body.laneIds) && body.laneIds.length > 0
  ? body.laneIds.map((laneId) => String(laneId))
  : laneCatalog.map((lane) => lane.id);

const selectedLanes = laneCatalog.filter((lane) => requestedLaneIds.includes(lane.id));
if (selectedLanes.length === 0) {
  return [{
    json: {
      success: false,
      workflow: 'vibe-printing-dry-run-pipeline',
      error: 'No valid laneIds were supplied.',
      availableLaneIds: laneCatalog.map((lane) => lane.id)
    }
  }];
}

const dailyTarget = clamp(Number(body.dailyTarget ?? 1), 1, 3);
const recentAngles = new Set(
  (Array.isArray(body.recentAngles) ? body.recentAngles : [])
    .map((value) => normalizeText(value).toLowerCase())
    .filter(Boolean)
);
const publishSlots = ['11:00', '15:00', '19:00'];

const perLaneBuckets = selectedLanes.map((lane, laneIndex) => ({
  laneId: lane.id,
  items: lane.angles
    .filter((angle) => !recentAngles.has(normalizeText(angle.titleAngle).toLowerCase()))
    .map((angle, angleIndex) => ({
      topicId: lane.id + '-' + slugify(angle.titleAngle),
      laneId: lane.id,
      laneLabel: lane.label,
      titleAngle: angle.titleAngle,
      seedQuestion: angle.seedQuestion,
      draftHook: angle.draftHook,
      riskLevel: angle.riskLevel,
      noveltyScore: Number((0.94 - (laneIndex * 0.03) - (angleIndex * 0.04)).toFixed(2)),
      publishSlot: publishSlots[angleIndex % publishSlots.length],
      autoPublishEligible: false,
      operatorMode: 'shadow-review'
    }))
}));

const selectedCandidates = [];
let keepSelecting = true;

while (keepSelecting && selectedCandidates.length < dailyTarget) {
  keepSelecting = false;

  for (const bucket of perLaneBuckets) {
    const nextItem = bucket.items.shift();

    if (!nextItem) {
      continue;
    }

    keepSelecting = true;
    selectedCandidates.push(nextItem);

    if (selectedCandidates.length >= dailyTarget) {
      break;
    }
  }
}

if (selectedCandidates.length === 0) {
  return [{
    json: {
      success: false,
      workflow: 'vibe-printing-dry-run-pipeline',
      error: 'No candidates were available after recentAngles filtering.'
    }
  }];
}

const topicIndex = clamp(Number(body.selectedTopicIndex ?? 0), 0, selectedCandidates.length - 1);
const selectedTopic = selectedCandidates[topicIndex];
const research = buildResearchPack(selectedTopic);
const scriptPack = buildScriptPack(selectedTopic, research);
const productionPacket = buildProductionPacket(selectedTopic, scriptPack.shortScript, scriptPack.metadataPack);

return [{
  json: {
    success: true,
    workflow: 'vibe-printing-dry-run-pipeline',
    generatedAt: new Date().toISOString(),
    runMode: 'free-dry-run',
    notes: [
      'No paid model calls were made in this run.',
      'Research packs use seeded offline references or placeholders.',
      'Voice and video outputs are production stubs, not rendered media.'
    ],
    planningSummary: {
      selectedCount: selectedCandidates.length,
      backlogCount: perLaneBuckets.reduce((count, bucket) => count + bucket.items.length, 0)
    },
    selectedTopic,
    research,
    scriptPack,
    productionPacket
  }
}];`;

export const workflowAssets: WorkflowAsset[] = [
  {
    fileName: "vibe-printing-research-pack-builder.workflow.json",
    workflow: createWebhookWorkflow({
      name: "Vibe Printing - Research Pack Builder",
      description:
        "Build a free research pack for one Vibe Printing topic using public Wikipedia search and summary endpoints. Input: topic object. Output: summary, claims, sources, and a storage-ready execution record.",
      path: "vibe-printing/research-pack-builder",
      webhookId: "4f86d7a1-7ea7-4d92-a959-f15c33fd7853",
      code: researchPackBuilderCode
    })
  },
  {
    fileName: "vibe-printing-short-script-generator.workflow.json",
    workflow: createWebhookWorkflow({
      name: "Vibe Printing - Short Script Generator",
      description:
        "Generate a short-form script pack from a Vibe Printing research pack without paid models. Input: topic plus researchPack. Output: shortScript, titles, description draft, and operator mode.",
      path: "vibe-printing/short-script-generator",
      webhookId: "204fce2a-6b24-4f16-baf4-faffb5106479",
      code: shortScriptGeneratorCode
    })
  },
  {
    fileName: "vibe-printing-production-packet-builder.workflow.json",
    workflow: createWebhookWorkflow({
      name: "Vibe Printing - Production Packet Builder",
      description:
        "Convert a short script into voice, video, scene, assembly, and publish stubs for a Vibe Printing YouTube Short. This is a dry-run handoff contract for later real providers.",
      path: "vibe-printing/production-packet-builder",
      webhookId: "b1940d03-02b5-4933-a3e4-3c3b2d490553",
      code: productionPacketBuilderCode
    })
  },
  {
    fileName: "vibe-printing-dry-run-pipeline.workflow.json",
    workflow: createWebhookWorkflow({
      name: "Vibe Printing - Dry Run Pipeline",
      description:
        "End-to-end free dry run for Vibe Printing. Chains the topic planner, research pack builder, short script generator, and production packet builder into one webhook entrypoint for testing.",
      path: "vibe-printing/dry-run-pipeline",
      webhookId: "2023e01c-17aa-4206-9c07-bb9df8aa2889",
      code: dryRunPipelineCode
    })
  }
];
