import fs from "node:fs";
import path from "node:path";
import type { ApprovalGateRecord, ApprovalStatus, PipelineState } from "../domain/models.js";
import { ensureDir } from "./fs-helpers.js";
import { PipelineHalt } from "./pipeline-halt.js";

export function ensureApprovalGate(
  state: PipelineState,
  workDir: string,
  gateId: string,
  label: string,
  artifactPath: string,
): ApprovalGateRecord {
  const approvalsDir = path.join(workDir, "approvals");
  ensureDir(approvalsDir);

  const filePath = path.join(approvalsDir, `${gateId}.json`);
  let record: ApprovalGateRecord;

  if (fs.existsSync(filePath)) {
    record = JSON.parse(fs.readFileSync(filePath, "utf-8")) as ApprovalGateRecord;
  } else {
    record = {
      gateId,
      label,
      status: "pending",
      required: true,
      updatedAt: new Date().toISOString(),
      reviewer: null,
      notes: null,
      artifactPath,
    };
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
  }

  state.approvals ??= {};
  state.approvals[gateId] = record;
  return record;
}

export function writeApprovalGate(workDir: string, gate: ApprovalGateRecord): void {
  const approvalsDir = path.join(workDir, "approvals");
  ensureDir(approvalsDir);
  const filePath = path.join(approvalsDir, `${gate.gateId}.json`);
  gate.updatedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(gate, null, 2));
}

export function isApproved(status: ApprovalStatus | undefined): boolean {
  return status === "approved";
}

export function haltForApproval(
  state: PipelineState,
  workDir: string,
  gate: ApprovalGateRecord,
  holdMessage: string,
): never {
  state.halted = true;
  state.haltReason = holdMessage;
  state.haltedGateId = gate.gateId;

  const holdPath = path.join(workDir, "HOLD.md");
  const content = [
    `# Pipeline Hold`,
    ``,
    `Gate: ${gate.label} (${gate.gateId})`,
    `Status: ${gate.status}`,
    `Artifact: ${gate.artifactPath}`,
    ``,
    holdMessage,
    ``,
    `Edit the approval file in: approvals/${gate.gateId}.json`,
    `Set status to \`approved\` to allow the pipeline to continue on a later run.`,
  ].join("\n");
  fs.writeFileSync(holdPath, content);

  throw new PipelineHalt(holdMessage, gate.gateId);
}
