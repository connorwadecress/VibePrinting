/**
 * Server-only utilities for inspecting and mutating a run directory.
 *
 * Owns: the canonical pipeline stage list, gate file IO, log-tail-derived
 * stage status, and a path-traversal-safe artifact resolver. Used by the
 * /api/runs/[jobId]/gates|resume|artifact routes.
 */

import fs from "node:fs";
import path from "node:path";
import type { ApprovalGateRecord, ApprovalStatus } from "@pipeline/domain/models";

export interface PipelineStageDescriptor {
  id: string;
  label: string;
  kind: "stage" | "gate";
  /** Only present when kind === "gate". The matching approval file id. */
  gateId?: string;
}

/**
 * The canonical stage order, mirroring src/pipeline/presets/shorts-pipeline.ts.
 * Keep this in sync if the preset changes.
 */
export const PIPELINE_STAGES: PipelineStageDescriptor[] = [
  { id: "topic-discovery", label: "Topic", kind: "stage" },
  { id: "research-pack", label: "Research", kind: "stage" },
  { id: "script-generation", label: "Script", kind: "stage" },
  { id: "script-approval-gate", label: "Script review", kind: "gate", gateId: "script-gate" },
  { id: "scene-plan", label: "Scene plan", kind: "stage" },
  { id: "storyboard-generation", label: "Storyboard", kind: "stage" },
  {
    id: "storyboard-approval-gate",
    label: "Storyboard review",
    kind: "gate",
    gateId: "storyboard-gate",
  },
  { id: "voiceover", label: "Voiceover", kind: "stage" },
  { id: "stock-footage", label: "Footage", kind: "stage" },
  { id: "assembly", label: "Assembly", kind: "stage" },
  { id: "caption-overlay", label: "Captions", kind: "stage" },
  { id: "final-approval-gate", label: "Final review", kind: "gate", gateId: "final-gate" },
  { id: "upload", label: "Publish", kind: "stage" },
];

export type StageRunStatus =
  | "idle"
  | "running"
  | "done"
  | "halted"
  | "approved"
  | "revisions_requested"
  | "rejected"
  | "failed";

export interface PipelineStageStatus extends PipelineStageDescriptor {
  status: StageRunStatus;
  /** For gates only — the full approval record. */
  gate?: ApprovalGateRecord;
  /** True when this stage is the active halt point for the current run. */
  active: boolean;
}

const APPROVALS_DIR = "approvals";
const GATE_HALT_RE = /^\[([a-z-]+gate)\]\s+halted:/;
const GATE_APPROVED_RE = /^\[([a-z-]+gate)\]\s+approved/i;
const STAGE_RUNNING_RE = /^\[pipeline\]\s+Running:\s+(\S+)/;
const STAGE_COMPLETED_RE = /^\[([a-z0-9-]+)\]\s+completed in /;

// ---------------------------------------------------------------------------
// Gate file IO
// ---------------------------------------------------------------------------

function approvalsDir(runDir: string): string {
  return path.join(runDir, APPROVALS_DIR);
}

/** Reject gate ids that contain path separators or traversal sequences. */
function isSafeGateId(gateId: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(gateId);
}

export function listGates(runDir: string): ApprovalGateRecord[] {
  const dir = approvalsDir(runDir);
  if (!fs.existsSync(dir)) return [];
  const records: ApprovalGateRecord[] = [];
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith(".json")) continue;
    try {
      const raw = fs.readFileSync(path.join(dir, entry), "utf-8");
      const record = JSON.parse(raw) as ApprovalGateRecord;
      if (record && typeof record.gateId === "string") records.push(record);
    } catch {
      // Skip unreadable / malformed gate files rather than crashing the page.
    }
  }
  return records.sort((a, b) => a.gateId.localeCompare(b.gateId));
}

export function readGate(runDir: string, gateId: string): ApprovalGateRecord | null {
  if (!isSafeGateId(gateId)) return null;
  const filePath = path.join(approvalsDir(runDir), `${gateId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as ApprovalGateRecord;
  } catch {
    return null;
  }
}

export interface GatePatch {
  status: ApprovalStatus;
  reviewer?: string | null;
  notes?: string | null;
}

export function patchGate(
  runDir: string,
  gateId: string,
  patch: GatePatch,
): ApprovalGateRecord | null {
  if (!isSafeGateId(gateId)) return null;
  const current = readGate(runDir, gateId);
  if (!current) return null;
  const next: ApprovalGateRecord = {
    ...current,
    status: patch.status,
    reviewer: patch.reviewer === undefined ? current.reviewer : patch.reviewer,
    notes: patch.notes === undefined ? current.notes : patch.notes,
    updatedAt: new Date().toISOString(),
  };
  const dir = approvalsDir(runDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${gateId}.json`);
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, filePath);
  return next;
}

// ---------------------------------------------------------------------------
// Stage status derivation from logs + gates
// ---------------------------------------------------------------------------

/**
 * Walk the log tail to find which stages have started / completed, then
 * overlay gate-approval state. Returns one entry per canonical stage.
 *
 * One stage is marked `active: true` — the operator's current focus point:
 *   - the most recent halted gate (highest priority), else
 *   - the currently-running stage, else
 *   - the first not-yet-run stage.
 */
export function deriveStages(
  runDir: string,
  logTail: string[],
): PipelineStageStatus[] {
  const started = new Set<string>();
  const completed = new Set<string>();
  let lastRunning: string | null = null;
  let lastHaltedGate: string | null = null;

  for (const raw of logTail) {
    const line = stripTimestamp(raw);
    const startMatch = line.match(STAGE_RUNNING_RE);
    if (startMatch) {
      started.add(startMatch[1]);
      lastRunning = startMatch[1];
      continue;
    }
    const haltMatch = line.match(GATE_HALT_RE);
    if (haltMatch) lastHaltedGate = haltMatch[1];
    const doneMatch = line.match(STAGE_COMPLETED_RE);
    if (doneMatch) {
      completed.add(doneMatch[1]);
      if (lastRunning === doneMatch[1]) lastRunning = null;
    }
  }

  const gates = new Map<string, ApprovalGateRecord>();
  for (const g of listGates(runDir)) gates.set(g.gateId, g);

  const out: PipelineStageStatus[] = [];
  let activeAssigned = false;
  let firstUnstartedIdx = -1;

  for (let i = 0; i < PIPELINE_STAGES.length; i++) {
    const desc = PIPELINE_STAGES[i];
    let status: StageRunStatus = "idle";
    let gate: ApprovalGateRecord | undefined;

    if (desc.kind === "gate") {
      gate = gates.get(desc.gateId!);
      if (gate) {
        if (gate.status === "approved") status = "approved";
        else if (gate.status === "revisions_requested") status = "revisions_requested";
        else if (gate.status === "rejected") status = "rejected";
        else status = "halted";
      } else if (started.has(desc.id) && !completed.has(desc.id)) {
        status = "running";
      } else if (completed.has(desc.id)) {
        status = "done";
      }
    } else {
      if (started.has(desc.id) && !completed.has(desc.id)) status = "running";
      else if (completed.has(desc.id)) status = "done";
    }

    if (status === "idle" && firstUnstartedIdx === -1) firstUnstartedIdx = i;

    out.push({ ...desc, status, gate, active: false });
  }

  // Pick the active stage.
  if (lastHaltedGate) {
    const idx = out.findIndex(
      (s) => s.kind === "gate" && s.id === lastHaltedGate && s.status === "halted",
    );
    if (idx !== -1) {
      out[idx].active = true;
      activeAssigned = true;
    }
  }
  if (!activeAssigned && lastRunning) {
    const idx = out.findIndex((s) => s.id === lastRunning);
    if (idx !== -1) {
      out[idx].active = true;
      activeAssigned = true;
    }
  }
  if (!activeAssigned && firstUnstartedIdx !== -1) {
    out[firstUnstartedIdx].active = true;
  }

  return out;
}

function stripTimestamp(line: string): string {
  // Lines look like "[7:17:27 PM] [stage] msg"
  return line.replace(/^\[\d{1,2}:\d{2}:\d{2}\s?[AP]M\]\s+/, "");
}

// ---------------------------------------------------------------------------
// Artifact resolver — path-traversal safe
// ---------------------------------------------------------------------------

/**
 * Resolve `name` to an absolute path inside `runDir`, or return null if
 * the resolved path escapes the run dir or doesn't exist as a file.
 */
export function resolveArtifact(runDir: string, name: string): string | null {
  if (!name || name.includes("\0")) return null;
  const baseAbs = path.resolve(runDir);
  const targetAbs = path.resolve(baseAbs, name);
  const rel = path.relative(baseAbs, targetAbs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  if (!fs.existsSync(targetAbs)) return null;
  if (!fs.statSync(targetAbs).isFile()) return null;
  return targetAbs;
}

const MIME_BY_EXT: Record<string, string> = {
  ".json": "application/json",
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

export function mimeForArtifact(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}
