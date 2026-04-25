import fs from "node:fs";
import path from "node:path";
import type { ChannelProfile } from "../domain/channel-profile.js";
import type {
  ApprovalGateRecord,
  AssetManifest,
  PipelineState,
  ResearchPack,
  ScenePlanWithKeywords,
  ShortScript,
  StockClip,
  StoryboardDeck,
  TopicCandidate,
  VoiceoverResult,
} from "../domain/models.js";
import { log } from "./logger.js";

const SCRIPT_FILE = "script.json";
const SCENES_FILE = "scene-plan.json";
const STORYBOARD_FILE = "storyboard.json";
const VOICEOVER_FILE = "voiceover.json";
const VOICEOVER_AUDIO = "voiceover.mp3";
const CLIPS_FILE = "clips.json";
const ASSEMBLED_VIDEO = "assembled.mp4";
const FINAL_VIDEO = "final.mp4";
const APPROVALS_DIR = "approvals";
const ASSET_MANIFEST = path.join("assets", "asset-manifest.json");

interface ScriptArtifact {
  topic?: TopicCandidate;
  research?: ResearchPack;
  script?: ShortScript;
}

function readJsonIfExists<T>(filePath: string): T | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch (err) {
    log("resume", `Failed to parse ${path.basename(filePath)}: ${(err as Error).message}`);
    return undefined;
  }
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

export function parseRunIdFromDir(workDir: string): string {
  const base = path.basename(path.resolve(workDir));
  return base.startsWith("run-") ? base.slice("run-".length) : base;
}

/**
 * Resolves a `--resume` argument into an absolute run directory.
 * Accepts:
 *   - "latest" → most recently modified `run-*` dir under outputDir
 *   - an absolute or relative path to a run dir
 *   - a bare run id like "20260425-090300" (resolved against outputDir)
 */
export function resolveResumeDir(arg: string, outputDir: string): string {
  if (arg === "latest") {
    const candidate = findLatestRunDir(outputDir);
    if (!candidate) throw new Error(`No run-* directories found under ${outputDir}`);
    return candidate;
  }

  const direct = path.resolve(arg);
  if (fs.existsSync(direct) && fs.statSync(direct).isDirectory()) return direct;

  const inOutput = path.resolve(outputDir, arg);
  if (fs.existsSync(inOutput) && fs.statSync(inOutput).isDirectory()) return inOutput;

  const prefixed = path.resolve(outputDir, arg.startsWith("run-") ? arg : `run-${arg}`);
  if (fs.existsSync(prefixed) && fs.statSync(prefixed).isDirectory()) return prefixed;

  throw new Error(`Resume target not found: ${arg} (looked in ${outputDir})`);
}

function findLatestRunDir(outputDir: string): string | undefined {
  if (!fs.existsSync(outputDir)) return undefined;
  const entries = fs
    .readdirSync(outputDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("run-"))
    .map((d) => {
      const full = path.join(outputDir, d.name);
      return { full, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return entries[0]?.full;
}

function loadApprovals(workDir: string): Record<string, ApprovalGateRecord> | undefined {
  const dir = path.join(workDir, APPROVALS_DIR);
  if (!fs.existsSync(dir)) return undefined;
  const out: Record<string, ApprovalGateRecord> = {};
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const record = readJsonIfExists<ApprovalGateRecord>(path.join(dir, file));
    if (record) out[record.gateId] = record;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Reconstructs PipelineState from artifacts on disk in `workDir`.
 *
 * Caller is responsible for resolving `state.lane` from the channel profile
 * using the topic's `laneId` after this returns — lane shape depends on the
 * profile and isn't persisted with the script artifact.
 */
export function loadRunState(workDir: string, profile: ChannelProfile): PipelineState {
  const state: PipelineState = {};

  const scriptArtifact = readJsonIfExists<ScriptArtifact>(path.join(workDir, SCRIPT_FILE));
  if (scriptArtifact) {
    state.topic = scriptArtifact.topic;
    state.research = scriptArtifact.research;
    state.script = scriptArtifact.script;
  }

  if (state.topic?.laneId) {
    const lane = profile.contentLanes.find((l) => l.id === state.topic!.laneId);
    if (lane) state.lane = lane;
  }

  const scenes = readJsonIfExists<ScenePlanWithKeywords[]>(path.join(workDir, SCENES_FILE));
  if (scenes) state.scenes = scenes;

  const storyboard = readJsonIfExists<StoryboardDeck>(path.join(workDir, STORYBOARD_FILE));
  if (storyboard) state.storyboard = storyboard;

  const voiceoverMeta = readJsonIfExists<VoiceoverResult>(path.join(workDir, VOICEOVER_FILE));
  if (voiceoverMeta && fs.existsSync(path.join(workDir, VOICEOVER_AUDIO))) {
    state.voiceover = { ...voiceoverMeta, audioPath: path.join(workDir, VOICEOVER_AUDIO) };
  }

  const clips = readJsonIfExists<StockClip[]>(path.join(workDir, CLIPS_FILE));
  if (clips && clips.every((c) => !c.localPath || fs.existsSync(c.localPath))) {
    state.clips = clips;
  }

  const assembledPath = path.join(workDir, ASSEMBLED_VIDEO);
  if (fs.existsSync(assembledPath)) state.rawVideoPath = assembledPath;

  const finalPath = path.join(workDir, FINAL_VIDEO);
  if (fs.existsSync(finalPath)) state.outputVideoPath = finalPath;

  const approvals = loadApprovals(workDir);
  if (approvals) state.approvals = approvals;

  const manifest = readJsonIfExists<AssetManifest>(path.join(workDir, ASSET_MANIFEST));
  if (manifest) state.assetManifest = manifest;

  return state;
}

export function writeScenes(workDir: string, scenes: ScenePlanWithKeywords[]): void {
  writeJson(path.join(workDir, SCENES_FILE), scenes);
}

export function writeVoiceoverMeta(workDir: string, voiceover: VoiceoverResult): void {
  const { audioPath, ...rest } = voiceover;
  writeJson(path.join(workDir, VOICEOVER_FILE), {
    ...rest,
    audioPath: path.basename(audioPath),
  });
}

export function writeClips(workDir: string, clips: StockClip[]): void {
  writeJson(path.join(workDir, CLIPS_FILE), clips);
}

export function describeResumedState(state: PipelineState): string[] {
  const parts: string[] = [];
  if (state.topic) parts.push("topic");
  if (state.research) parts.push("research");
  if (state.script) parts.push("script");
  if (state.scenes) parts.push(`scenes(${state.scenes.length})`);
  if (state.storyboard) parts.push("storyboard");
  if (state.voiceover) parts.push("voiceover");
  if (state.clips) parts.push(`clips(${state.clips.length})`);
  if (state.rawVideoPath) parts.push("assembled");
  if (state.outputVideoPath) parts.push("final");
  if (state.approvals) parts.push(`approvals(${Object.keys(state.approvals).length})`);
  return parts;
}
