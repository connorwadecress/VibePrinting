"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JobRecord } from "@/lib/job-store";
import type { ApprovalGateRecord } from "@pipeline/domain/models";
import type { PipelineStageStatus } from "@/lib/run-artifacts";
import { PipelineProgress } from "./PipelineProgress";
import { ApprovalPanel } from "./ApprovalPanel";

const TERMINAL = new Set(["success", "failed", "cancelled"]);

interface Props {
  initialJob: JobRecord;
}

interface GatesResponse {
  runDir: string | null;
  stages: PipelineStageStatus[];
  gates: ApprovalGateRecord[];
}

/**
 * Top-level detail view for a single job. Owns:
 *  - SSE log streaming (live updates while child is running)
 *  - polling /api/runs/[jobId]/gates (every 3s, plus on every log line and
 *    on every status change) so the progress strip stays current even when
 *    the only thing that changed is an operator approving a gate from
 *    another tab
 *  - rendering the pipeline progress strip, the active-gate approval
 *    panel, and the log view
 */
export function RunDetailView({ initialJob }: Props) {
  const router = useRouter();
  const [job, setJob] = useState<JobRecord>(initialJob);
  const [lines, setLines] = useState<string[]>(
    TERMINAL.has(initialJob.status) ? initialJob.logTail : [],
  );
  const [gatesData, setGatesData] = useState<GatesResponse | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);
  const followRef = useRef(true);

  const fetchGates = useCallback(async () => {
    try {
      const res = await fetch(`/api/runs/${encodeURIComponent(initialJob.jobId)}/gates`);
      if (!res.ok) return;
      const data = (await res.json()) as GatesResponse;
      setGatesData(data);
    } catch {
      // Network blip — leave the previous snapshot in place.
    }
  }, [initialJob.jobId]);

  // Throttled variant for high-frequency callers (SSE log events).
  const lastGateFetchRef = useRef(0);
  const pendingGateFetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const throttledFetchGates = useCallback(() => {
    const now = Date.now();
    if (now - lastGateFetchRef.current > 2000) {
      lastGateFetchRef.current = now;
      fetchGates();
    } else if (!pendingGateFetchRef.current) {
      pendingGateFetchRef.current = setTimeout(() => {
        pendingGateFetchRef.current = null;
        lastGateFetchRef.current = Date.now();
        fetchGates();
      }, 2000);
    }
  }, [fetchGates]);

  // Initial gate fetch + polling while job is live.
  useEffect(() => {
    fetchGates();
  }, [fetchGates]);

  useEffect(() => {
    // Poll every 3s as long as the page is open. Cheap (single small JSON
    // file) and covers cross-tab approvals + post-halt updates.
    const id = setInterval(fetchGates, 3000);
    return () => clearInterval(id);
  }, [fetchGates]);

  // SSE log streaming. Only attach while the child process is running;
  // terminal jobs already have their full log in initialJob.logTail.
  useEffect(() => {
    if (TERMINAL.has(initialJob.status)) return;

    const es = new EventSource(
      `/api/runs/stream?jobId=${encodeURIComponent(initialJob.jobId)}`,
    );
    es.addEventListener("log", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as { line: string };
        setLines((prev) => [...prev, data.line]);
        // Stage status may have changed — throttled to avoid hammering.
        throttledFetchGates();
      } catch {}
    });
    es.addEventListener("status", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as { job: JobRecord };
        setJob(data.job);
        fetchGates();
      } catch {}
    });
    es.addEventListener("end", () => {
      es.close();
      fetchGates();
      router.refresh();
    });
    es.onerror = () => {};
    return () => {
      es.close();
      if (pendingGateFetchRef.current) clearTimeout(pendingGateFetchRef.current);
    };
  }, [initialJob.jobId, initialJob.status, fetchGates, throttledFetchGates, router]);

  // Auto-scroll log view to the bottom unless the user has scrolled up.
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    if (followRef.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  function onScroll() {
    const el = logRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    followRef.current = atBottom;
  }

  async function onCancel() {
    setCancelling(true);
    try {
      await fetch(`/api/runs/${encodeURIComponent(initialJob.jobId)}/cancel`, {
        method: "POST",
      });
    } finally {
      setCancelling(false);
    }
  }

  const isLive = !TERMINAL.has(job.status);
  const stages = gatesData?.stages ?? [];
  const gates = gatesData?.gates ?? [];
  const activeStage = stages.find((s) => s.active);
  const showApprovalPanel = activeStage?.kind === "gate" && activeStage.gate;

  // Resume is offered when the job is terminal, at least one gate is
  // approved, and there's still pipeline work pending (any non-gate stage
  // still idle, or any gate still halted/pending). Lives at the top so it
  // doesn't disappear when the active-gate panel hides itself.
  const anyApproved = gates.some((g) => g.status === "approved");
  const morePipelineWork =
    stages.some((s) => s.kind !== "gate" && s.status === "idle") ||
    stages.some((s) => s.kind === "gate" && (s.status === "halted" || s.status === "idle"));
  const showResume = !isLive && anyApproved && morePipelineWork;
  const [resuming, setResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  async function onResume() {
    setResuming(true);
    setResumeError(null);
    try {
      const res = await fetch(`/api/runs/${encodeURIComponent(initialJob.jobId)}/resume`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      router.push(`/runs/${encodeURIComponent(body.jobId)}`);
    } catch (err) {
      setResumeError((err as Error).message);
      setResuming(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <StatusBadge status={job.status} />
          {isLive && (
            <span className="relative inline-flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
          )}
          <span className="font-mono text-xs text-fg-subtle">{job.jobId}</span>
        </div>
        {isLive && (
          <button onClick={onCancel} disabled={cancelling} className="btn-danger btn-sm">
            {cancelling ? "Cancelling…" : "Cancel"}
          </button>
        )}
      </div>

      {showResume && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-success/40 bg-success/5 px-4 py-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="pill-success">ready</span>
            <span className="text-fg">
              {gates.filter((g) => g.status === "approved").length} of {gates.length} gate
              {gates.length === 1 ? "" : "s"} approved — continue the pipeline.
            </span>
          </div>
          <div className="flex items-center gap-3">
            {resumeError && <span className="text-xs text-danger">{resumeError}</span>}
            <button
              type="button"
              onClick={onResume}
              disabled={resuming}
              className="btn-primary btn-sm"
            >
              {resuming ? "Spawning…" : "Resume pipeline →"}
            </button>
          </div>
        </div>
      )}

      {stages.length > 0 && <PipelineProgress stages={stages} />}

      {showApprovalPanel && activeStage && (
        <ApprovalPanel
          jobId={initialJob.jobId}
          stage={activeStage}
          gates={gates}
          onAfterAction={fetchGates}
        />
      )}

      <details className="card overflow-hidden" open>
        <summary className="flex cursor-pointer items-center justify-between border-b border-border px-4 py-3 text-sm font-medium text-fg">
          <span>Log</span>
          <span className="text-[10px] text-fg-subtle">{lines.length} lines</span>
        </summary>
        <pre
          ref={logRef}
          onScroll={onScroll}
          className="h-[40vh] overflow-auto bg-[#070810] p-4 font-mono text-xs leading-relaxed text-fg shadow-inner shadow-black/50"
        >
          {lines.length === 0 ? (
            <span className="text-fg-subtle">(no output yet)</span>
          ) : (
            lines.join("\n")
          )}
        </pre>
      </details>
    </div>
  );
}

function StatusBadge({ status }: { status: JobRecord["status"] }) {
  const cls =
    status === "success"
      ? "pill-success"
      : status === "failed"
        ? "pill-danger"
        : status === "cancelled"
          ? "pill-muted"
          : "pill-info";
  return <span className={cls}>{status}</span>;
}
