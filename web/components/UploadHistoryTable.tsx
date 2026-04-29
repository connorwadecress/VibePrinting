"use client";

import type { UploadLogEntry } from "@pipeline/domain/upload-log";

/**
 * Read-only upload history table. Renders newest-first; always
 * scoped to the active brand selected in the header dropdown.
 * No auto-refresh — operators reload manually after a run.
 */

interface Props {
  entries: UploadLogEntry[];
}

export function UploadHistoryTable({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface/60 px-4 py-10 text-center text-xs text-fg-muted">
        No upload attempts logged yet.
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Lane</th>
            <th>Platform</th>
            <th>Status</th>
            <th>Title</th>
            <th className="text-right">Took</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={`${e.runId}-${e.platform}-${i}`}>
              <td data-label="When" className="whitespace-nowrap font-mono text-xs text-fg-muted">
                {formatTime(e.ts)}
              </td>
              <td data-label="Lane" className="font-mono text-xs text-fg-muted">{e.lane ?? "—"}</td>
              <td data-label="Platform" className="text-fg-muted">{e.platform}</td>
              <td data-label="Status">
                <StatusPill status={e.status} />
              </td>
              <td data-label="Title" className="text-fg">
                {e.url && e.title ? (
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent hover:text-accent-hover"
                  >
                    {e.title}
                  </a>
                ) : e.error ? (
                  <span className="text-danger">{e.error}</span>
                ) : (
                  e.title ?? "—"
                )}
              </td>
              <td data-label="Took" className="text-right font-mono text-xs text-fg-subtle">
                {formatDuration(e.durationMs)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: UploadLogEntry["status"] }) {
  return <span className={status === "success" ? "pill-success" : "pill-danger"}>{status}</span>;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
