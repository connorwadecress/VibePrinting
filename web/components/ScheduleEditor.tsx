"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ScheduleEntry } from "@/lib/schedule-fs";

/**
 * One row per brand. Edits PUT to /api/schedule/[brandId] on save;
 * the file watch on the server side picks the change up without a
 * restart and re-arms (or removes) the cron task.
 */

export interface BrandRowInput {
  brandId: string;
  displayName: string;
  lanes: { id: string }[];
  entry: ScheduleEntry | null;
}

const DEFAULT_ENTRY: ScheduleEntry = {
  enabled: false,
  cron: "0 11 * * *",
  lane: null,
  platforms: [],
  dryRun: false,
  skipIfRunning: true,
  lastRunAt: null,
  lastJobId: null,
};

export function ScheduleEditor({
  rows,
  initialPaused,
}: {
  rows: BrandRowInput[];
  initialPaused: boolean;
}) {
  const [paused, setPaused] = useState(initialPaused);
  const [pendingPause, startPauseTransition] = useTransition();

  async function togglePause() {
    const next = !paused;
    setPaused(next);
    startPauseTransition(async () => {
      await fetch("/api/schedule/pause", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ globalPaused: next }),
      });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-4 py-3">
        <div>
          <div className="text-sm font-medium text-neutral-900">Global pause</div>
          <div className="text-xs text-neutral-500">
            When on, no scheduled jobs fire. Manual triggers still work.
          </div>
        </div>
        <button
          onClick={togglePause}
          disabled={pendingPause}
          className={
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 " +
            (paused
              ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
              : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200")
          }
        >
          {paused ? "Paused" : "Active"}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-xs text-neutral-500">
          No brands configured.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.brandId}>
              <BrandRow row={row} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BrandRow({ row }: { row: BrandRowInput }) {
  const router = useRouter();
  const initial = row.entry ?? DEFAULT_ENTRY;
  const [enabled, setEnabled] = useState(initial.enabled);
  const [cronExpr, setCronExpr] = useState(initial.cron);
  const [lane, setLane] = useState<string>(initial.lane ?? "");
  const [dryRun, setDryRun] = useState(initial.dryRun);
  const [youtube, setYoutube] = useState(initial.platforms.includes("youtube"));
  const [tiktok, setTiktok] = useState(initial.platforms.includes("tiktok"));
  const [skipIfRunning, setSkipIfRunning] = useState(initial.skipIfRunning);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const platforms: string[] = [];
      if (youtube) platforms.push("youtube");
      if (tiktok) platforms.push("tiktok");
      const res = await fetch(`/api/schedule/${encodeURIComponent(row.brandId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled,
          cron: cronExpr,
          lane: lane || null,
          platforms,
          dryRun,
          skipIfRunning,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? `HTTP ${res.status}`);
      } else {
        setSavedAt(Date.now());
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <div className="text-sm font-medium text-neutral-900">{row.displayName}</div>
          <div className="font-mono text-xs text-neutral-500">{row.brandId}</div>
        </div>
        <label className="flex items-center gap-2 text-xs text-neutral-700">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          Enabled
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-700">Cron</span>
          <input
            type="text"
            value={cronExpr}
            onChange={(e) => setCronExpr(e.target.value)}
            placeholder="0 11,15,19 * * *"
            className="block w-full rounded border border-neutral-300 bg-white px-2 py-1.5 font-mono text-xs"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-700">Lane</span>
          <select
            value={lane}
            onChange={(e) => setLane(e.target.value)}
            className="block w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">(any)</option>
            {row.lanes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-neutral-800">
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} className="h-4 w-4" />
          Dry run
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-800">
          <input
            type="checkbox"
            checked={youtube}
            onChange={(e) => setYoutube(e.target.checked)}
            className="h-4 w-4"
            disabled={dryRun}
          />
          YouTube
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-800">
          <input
            type="checkbox"
            checked={tiktok}
            onChange={(e) => setTiktok(e.target.checked)}
            className="h-4 w-4"
            disabled={dryRun}
          />
          TikTok
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-800">
          <input
            type="checkbox"
            checked={skipIfRunning}
            onChange={(e) => setSkipIfRunning(e.target.checked)}
            className="h-4 w-4"
          />
          Skip if a job is already running
        </label>
      </fieldset>

      {error && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
        <div>
          {initial.lastRunAt && (
            <span>
              Last run: <span className="font-mono">{new Date(initial.lastRunAt).toLocaleString()}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {savedAt && <span className="text-emerald-600">saved</span>}
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
