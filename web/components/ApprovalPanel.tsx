"use client";

import { useState } from "react";
import type { ApprovalGateRecord } from "@pipeline/domain/models";
import type { PipelineStageStatus } from "@/lib/run-artifacts";
import { ScriptPreview } from "./ScriptPreview";
import { StoryboardPreview } from "./StoryboardPreview";

type Action = "approve" | "request_revisions" | "reject";

interface Props {
  jobId: string;
  stage: PipelineStageStatus;
  gates: ApprovalGateRecord[];
  onAfterAction: () => void;
}

/**
 * Renders the artifact for the active gate plus approve / request revisions
 * / reject actions. After any action the parent re-fetches gates via
 * onAfterAction. When at least one gate is approved, a "Resume pipeline"
 * button appears that POSTs to /resume and routes to the new jobId.
 */
export function ApprovalPanel({ jobId, stage, gates: _gates, onAfterAction }: Props) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gate = stage.gate;
  if (!gate) return null;

  const isFinal = gate.status !== "pending";

  async function handleAction(action: Action) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(
        `/api/runs/${encodeURIComponent(jobId)}/gates/${encodeURIComponent(gate!.gateId)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, notes: notes.trim() || null }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setNotes("");
      onAfterAction();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card space-y-4 p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-fg">{gate.label}</h3>
          <p className="mt-0.5 text-xs text-fg-subtle">
            Gate <code className="font-mono">{gate.gateId}</code>
            {gate.reviewer && <> · last action by {gate.reviewer}</>}
          </p>
        </div>
        <GateBadge status={gate.status} />
      </header>

      {gate.notes && (
        <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
          <div className="section-title mb-1">Last note</div>
          <p className="whitespace-pre-wrap text-fg">{gate.notes}</p>
        </div>
      )}

      <div>
        <ArtifactPreview gateId={gate.gateId} jobId={jobId} />
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <label htmlFor="gate-notes" className="label">
          Notes / change request
        </label>
        <textarea
          id="gate-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional. Required-ish if you're requesting changes — be specific about what needs to change."
          rows={3}
          maxLength={4000}
          className="input"
        />
        {error && <p className="alert-error">{error}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={busy !== null}
            onClick={() => handleAction("approve")}
          >
            {busy === "approve" ? "Approving…" : isFinal ? "Re-approve" : "Approve"}
          </button>
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={busy !== null}
            onClick={() => handleAction("request_revisions")}
          >
            {busy === "request_revisions" ? "Saving…" : "Request changes"}
          </button>
          <button
            type="button"
            className="btn-danger btn-sm"
            disabled={busy !== null}
            onClick={() => handleAction("reject")}
          >
            {busy === "reject" ? "Rejecting…" : "Reject"}
          </button>
        </div>
      </div>
    </section>
  );
}

function ArtifactPreview({ gateId, jobId }: { gateId: string; jobId: string }) {
  if (gateId === "script-gate") return <ScriptPreview jobId={jobId} />;
  if (gateId === "storyboard-gate") return <StoryboardPreview jobId={jobId} />;
  if (gateId === "final-gate") return <FinalVideoPreview jobId={jobId} />;
  return (
    <p className="text-xs text-fg-subtle">No preview available for gate &quot;{gateId}&quot;.</p>
  );
}

function FinalVideoPreview({ jobId }: { jobId: string }) {
  const url = `/api/runs/${encodeURIComponent(jobId)}/artifact?name=final.mp4`;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-black">
      <video
        controls
        playsInline
        preload="metadata"
        className="block max-h-[70vh] w-full bg-black"
        src={url}
      >
        Your browser cannot play this video.
      </video>
    </div>
  );
}

function GateBadge({ status }: { status: ApprovalGateRecord["status"] }) {
  switch (status) {
    case "approved":
      return <span className="pill-success">approved</span>;
    case "rejected":
      return <span className="pill-danger">rejected</span>;
    case "revisions_requested":
      return <span className="pill-warning">revisions requested</span>;
    default:
      return <span className="pill-warning">pending review</span>;
  }
}
