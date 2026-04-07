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
    // Only attach SSE if the job is still live. Terminal jobs render
    // their captured logTail directly from the server prop.
    if (TERMINAL.has(initialJob.status)) {
      setLines(initialJob.logTail);
      return;
    }
    // Reset to the server-provided buffer; the SSE replay will refill it.
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
      // Pull a fresh server-rendered version once the run lands.
      router.refresh();
    });
    es.onerror = () => {
      // EventSource auto-retries on transient errors; we let it.
    };
    return () => es.close();
  }, [initialJob.jobId, initialJob.status, initialJob.logTail, router]);

  // Auto-scroll to the bottom unless the user has scrolled up.
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <StatusBadge status={job.status} />
          <span className="font-mono text-xs text-neutral-500">{job.jobId}</span>
        </div>
        {!TERMINAL.has(job.status) && (
          <button
            onClick={onCancel}
            disabled={cancelling}
            className="rounded-md border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelling ? "Cancelling…" : "Cancel"}
          </button>
        )}
      </div>

      <pre
        ref={logRef}
        onScroll={onScroll}
        className="h-[60vh] overflow-auto rounded-md border border-neutral-200 bg-neutral-950 p-3 font-mono text-xs leading-relaxed text-neutral-100"
      >
        {lines.length === 0 ? (
          <span className="text-neutral-500">(no output yet)</span>
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
      ? "bg-emerald-100 text-emerald-800"
      : status === "failed"
        ? "bg-red-100 text-red-800"
        : status === "cancelled"
          ? "bg-neutral-200 text-neutral-700"
          : "bg-indigo-100 text-indigo-800";
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
