"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JobRecord } from "@/lib/job-store";

/**
 * Live job log viewer. Connects to /api/runs/stream?jobId=... via
 * EventSource and renders the streamed log lines plus the latest
 * status. The server replays the buffered logTail on connect, so a
 * mid-run reload picks up the prefix.
 */

const TERMINAL = new Set(["success", "failed", "cancelled"]);

interface Props {
  initialJob: JobRecord;
}

export function RunStreamView({ initialJob }: Props) {
  const router = useRouter();
  const [job, setJob] = useState<JobRecord>(initialJob);
  const [lines, setLines] = useState<string[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);
  const followRef = useRef(true);

  useEffect(() => {
    if (TERMINAL.has(initialJob.status)) {
      setLines(initialJob.logTail);
      return;
    }
    setLines([]);

    const es = new EventSource(`/api/runs/stream?jobId=${encodeURIComponent(initialJob.jobId)}`);
    es.addEventListener("log", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as { line: string };
        setLines((prev) => [...prev, data.line]);
      } catch {}
    });
    es.addEventListener("status", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as { job: JobRecord };
        setJob(data.job);
      } catch {}
    });
    es.addEventListener("end", () => {
      es.close();
      router.refresh();
    });
    es.onerror = () => {};
    return () => es.close();
  }, [initialJob.jobId, initialJob.status, initialJob.logTail, router]);

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
      await fetch(`/api/runs/${encodeURIComponent(initialJob.jobId)}/cancel`, { method: "POST" });
    } finally {
      setCancelling(false);
    }
  }

  const isLive = !TERMINAL.has(job.status);

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <StatusBadge status={job.status} />
          {isLive && (
            <span className="relative inline-flex h-2 w-2">
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

      <pre
        ref={logRef}
        onScroll={onScroll}
        className="h-[60vh] overflow-auto rounded-xl border border-border bg-[#070810] p-4 font-mono text-xs leading-relaxed text-fg shadow-inner shadow-black/50"
      >
        {lines.length === 0 ? (
          <span className="text-fg-subtle">(no output yet)</span>
        ) : (
          lines.join("\n")
        )}
      </pre>
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
