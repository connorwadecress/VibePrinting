"use client";

import type { PipelineStageStatus, StageRunStatus } from "@/lib/run-artifacts";

/**
 * Horizontal stepper showing every stage in the canonical pipeline. Each
 * node renders an icon by status, a short label, and highlights the
 * currently-active stage (running or halted) with a pulse ring.
 */
export function PipelineProgress({ stages }: { stages: PipelineStageStatus[] }) {
  if (stages.length === 0) return null;
  return (
    <div className="card overflow-x-auto px-4 py-4">
      <ol className="flex min-w-max items-center gap-2">
        {stages.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2">
            <StageNode stage={s} />
            {i < stages.length - 1 && <Connector status={s.status} />}
          </li>
        ))}
      </ol>
    </div>
  );
}

function StageNode({ stage }: { stage: PipelineStageStatus }) {
  const tone = toneFor(stage.status);
  const ring = stage.active ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : "";
  const pulse = stage.active && (stage.status === "running" || stage.status === "halted");
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative ${ring} rounded-full`}>
        {pulse && (
          <span className="absolute inset-0 -z-0 animate-ping rounded-full bg-accent/40" />
        )}
        <div
          className={`relative z-10 grid h-9 w-9 place-items-center rounded-full text-[11px] font-semibold ${tone.dot}`}
          title={`${stage.label} — ${humanStatus(stage.status)}`}
        >
          <StageIcon status={stage.status} kind={stage.kind} />
        </div>
      </div>
      <div className="flex flex-col items-center text-center">
        <span className="text-[11px] font-medium leading-tight text-fg">{stage.label}</span>
        {stage.kind === "gate" && (
          <span className="text-[9px] uppercase tracking-wide text-fg-subtle">gate</span>
        )}
      </div>
    </div>
  );
}

function Connector({ status }: { status: StageRunStatus }) {
  const done = status === "done" || status === "approved";
  return (
    <div
      className={`h-px w-6 sm:w-10 ${done ? "bg-success/60" : "bg-border-strong"}`}
      aria-hidden
    />
  );
}

function StageIcon({ status, kind }: { status: StageRunStatus; kind: "stage" | "gate" }) {
  switch (status) {
    case "done":
    case "approved":
      return <span aria-hidden>✓</span>;
    case "running":
      return (
        <span
          aria-hidden
          className="block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      );
    case "halted":
      return <span aria-hidden>⏸</span>;
    case "revisions_requested":
      return <span aria-hidden>↻</span>;
    case "rejected":
    case "failed":
      return <span aria-hidden>✕</span>;
    default:
      return <span aria-hidden>{kind === "gate" ? "◇" : "◯"}</span>;
  }
}

function humanStatus(s: StageRunStatus): string {
  return s.replace("_", " ");
}

function toneFor(status: StageRunStatus): { dot: string } {
  switch (status) {
    case "done":
    case "approved":
      return { dot: "bg-success/20 text-success ring-1 ring-inset ring-success/40" };
    case "running":
      return { dot: "bg-info/20 text-info ring-1 ring-inset ring-info/40" };
    case "halted":
      return { dot: "bg-warning/20 text-warning ring-1 ring-inset ring-warning/50" };
    case "revisions_requested":
      return { dot: "bg-warning/15 text-warning ring-1 ring-inset ring-warning/40" };
    case "rejected":
    case "failed":
      return { dot: "bg-danger/20 text-danger ring-1 ring-inset ring-danger/40" };
    default:
      return { dot: "bg-surface-3 text-fg-subtle ring-1 ring-inset ring-border-strong" };
  }
}
