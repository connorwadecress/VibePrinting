"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { UploadLogEntry } from "@pipeline/domain/upload-log";

/**
 * Read-only upload history table. Renders newest-first; the brand
 * filter is a query param so the URL is shareable. No auto-refresh
 * — operators reload manually after a run.
 */

interface Props {
  entries: UploadLogEntry[];
  brands: string[];
  selectedBrand: string | null;
}

export function UploadHistoryTable({ entries, brands, selectedBrand }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function setBrand(value: string) {
    const next = new URLSearchParams(params?.toString() ?? "");
    if (value) next.set("brand", value);
    else next.delete("brand");
    router.push(`/uploads${next.toString() ? `?${next}` : ""}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="label">Brand</label>
        <select
          value={selectedBrand ?? ""}
          onChange={(e) => setBrand(e.target.value)}
          className="input input-sm w-auto min-w-[10rem]"
        >
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <span className="pill-muted">{entries.length} entries</span>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/60 px-4 py-10 text-center text-xs text-fg-muted">
          No upload attempts logged yet.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Brand</th>
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
                  <td data-label="Brand" className="font-medium text-fg">{e.brandId}</td>
                  <td data-label="Lane" className="text-fg-muted">{e.lane ?? "—"}</td>
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
      )}
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
