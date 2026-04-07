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
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-neutral-700">Brand</label>
        <select
          value={selectedBrand ?? ""}
          onChange={(e) => setBrand(e.target.value)}
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm"
        >
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-500">{entries.length} entries</span>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-xs text-neutral-500">
          No upload attempts logged yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left">When</th>
                <th className="px-3 py-2 text-left">Brand</th>
                <th className="px-3 py-2 text-left">Lane</th>
                <th className="px-3 py-2 text-left">Platform</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-right">Took</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={`${e.runId}-${e.platform}-${i}`} className="border-t border-neutral-100 align-top">
                  <td className="px-3 py-2 font-mono text-xs text-neutral-600">
                    {formatTime(e.ts)}
                  </td>
                  <td className="px-3 py-2 text-neutral-800">{e.brandId}</td>
                  <td className="px-3 py-2 text-neutral-600">{e.lane ?? "—"}</td>
                  <td className="px-3 py-2 text-neutral-600">{e.platform}</td>
                  <td className="px-3 py-2">
                    <StatusPill status={e.status} />
                  </td>
                  <td className="px-3 py-2 text-neutral-700">
                    {e.url && e.title ? (
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        {e.title}
                      </a>
                    ) : e.error ? (
                      <span className="text-red-700">{e.error}</span>
                    ) : (
                      e.title ?? "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-neutral-500">
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
  const cls =
    status === "success"
      ? "bg-emerald-100 text-emerald-800"
      : "bg-red-100 text-red-800";
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
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
