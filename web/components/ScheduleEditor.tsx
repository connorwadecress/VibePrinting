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
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <div className="text-sm font-semibold text-fg">Global pause</div>
          <div className="mt-0.5 text-xs text-fg-muted">
            When on, no scheduled jobs fire. Manual triggers still work.
          </div>
        </div>
        <button
          onClick={togglePause}
          disabled={pendingPause}
          className={
            "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 " +
            (paused
              ? "border-warning/40 bg-warning/15 text-warning hover:bg-warning/25"
              : "border-success/40 bg-success/15 text-success hover:bg-success/25")
          }
        >
          <span
            className={
              "h-2 w-2 rounded-full " + (paused ? "bg-warning" : "bg-success")
            }
          />
          {paused ? "Paused" : "Active"}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/60 px-4 py-10 text-center text-xs text-fg-muted">
          No brands configured.
        </div>
      ) : (
        <ul className="space-y-4">
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
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-fg">{row.displayName}</div>
          <div className="mt-0.5 font-mono text-[11px] text-fg-subtle">{row.brandId}</div>
        </div>
        <label className="flex items-center gap-2 text-xs text-fg-muted">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-border bg-surface"
          />
          Enabled
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Cron</span>
          <input
            type="text"
            value={cronExpr}
            onChange={(e) => setCronExpr(e.target.value)}
            placeholder="0 11,15,19 * * *"
            className="input input-sm mt-1.5 font-mono"
          />
        </label>

        <label className="block">
          <span className="label">Lane</span>
          <select
            value={lane}
            onChange={(e) => setLane(e.target.value)}
            className="input input-sm mt-1.5"
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

      <fieldset className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <Check label="Dry run" checked={dryRun} onChange={setDryRun} />
        <Check label="YouTube" checked={youtube} onChange={setYoutube} disabled={dryRun} />
        <Check label="TikTok" checked={tiktok} onChange={setTiktok} disabled={dryRun} />
        <Check
          label="Skip if a job is already running"
          checked={skipIfRunning}
          onChange={setSkipIfRunning}
        />
      </fieldset>

      {error && <div className="mt-4 alert-error">{error}</div>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-fg-muted">
        <div>
          {initial.lastRunAt && (
            <span>
              Last run:{" "}
              <span className="font-mono text-fg-muted">
                {new Date(initial.lastRunAt).toLocaleString()}
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {savedAt && <span className="text-success">saved</span>}
          <button onClick={save} disabled={saving} className="btn-primary btn-sm">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={
        "flex items-center gap-2 text-sm " +
        (disabled ? "cursor-not-allowed text-fg-subtle" : "text-fg-muted hover:text-fg")
      }
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border bg-surface"
        disabled={disabled}
      />
      {label}
    </label>
  );
}
