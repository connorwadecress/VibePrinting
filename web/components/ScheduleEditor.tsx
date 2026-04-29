"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ScheduleEntry, ScheduleLaneType } from "@/lib/schedule-fs";

/**
 * Multi-schedule editor for one brand. The page passes the brand's
 * lanes and existing schedule entries; this component owns the list
 * locally, and a "Save schedules" button PUTs the whole array to
 * /api/schedule/[brandId] with replace-all semantics.
 *
 * Each schedule has its own type filter (pexels-api / reddit-story /
 * any), lane (filtered by type), cron, and upload platforms. Use the
 * "Add schedule" button to add another row — e.g. one for Reddit
 * stories at 11am, another for topic-driven videos at 7pm.
 */

export interface BrandLaneOption {
  id: string;
  type: "pexels-api" | "reddit-story";
}

export interface BrandRowInput {
  brandId: string;
  displayName: string;
  lanes: BrandLaneOption[];
  entries: ScheduleEntry[];
}

const TYPE_LABEL: Record<ScheduleLaneType, string> = {
  "pexels-api": "Topic-driven",
  "reddit-story": "Reddit story",
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
            When on, no schedule fires. Manual triggers still work.
          </div>
        </div>
        <button
          onClick={togglePause}
          disabled={pendingPause}
          className={
            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 " +
            (paused
              ? "border-warning/40 bg-warning/15 text-warning hover:bg-warning/25"
              : "border-success/40 bg-success/15 text-success hover:bg-success/25")
          }
        >
          <span className={"size-2 rounded-full " + (paused ? "bg-warning" : "bg-success")} />
          {paused ? "Paused" : "Active"}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/60 px-4 py-10 text-center text-xs text-fg-muted">
          No brand selected.
        </div>
      ) : (
        rows.map((row) => <BrandSchedules key={row.brandId} row={row} />)
      )}
    </div>
  );
}

function newDraftEntry(brandId: string): ScheduleEntry {
  return {
    id: "",
    brandId,
    name: "",
    enabled: false,
    cron: "0 11 * * *",
    laneType: null,
    lane: null,
    platforms: ["youtube", "tiktok"],
    dryRun: false,
    skipIfRunning: true,
    lastRunAt: null,
    lastJobId: null,
  };
}

function BrandSchedules({ row }: { row: BrandRowInput }) {
  const router = useRouter();
  const [entries, setEntries] = useState<ScheduleEntry[]>(row.entries);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Track dirty against the initial server-rendered state so the save
  // button only highlights when there are real changes.
  const isDirty = JSON.stringify(entries) !== JSON.stringify(row.entries);

  function update(idx: number, patch: Partial<ScheduleEntry>) {
    setEntries((cur) => cur.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }
  function add() {
    setEntries((cur) => [...cur, newDraftEntry(row.brandId)]);
  }
  function remove(idx: number) {
    setEntries((cur) => cur.filter((_, i) => i !== idx));
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/schedule/${encodeURIComponent(row.brandId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schedules: entries }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? `HTTP ${res.status}`);
      } else {
        const data = (await res.json()) as { schedules: ScheduleEntry[] };
        setEntries(data.schedules);
        setSavedAt(Date.now());
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/60 px-4 py-8 text-center text-xs text-fg-subtle">
          No schedules yet. Add one to set up a recurring run.
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry, idx) => (
            <li key={entry.id || `draft-${idx}`}>
              <ScheduleRow
                entry={entry}
                lanes={row.lanes}
                onUpdate={(patch) => update(idx, patch)}
                onRemove={() => remove(idx)}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={add}
          className="cursor-pointer rounded-lg border border-dashed border-border bg-surface/40 px-4 py-2.5 text-xs font-medium text-fg-muted transition-colors hover:border-accent/40 hover:bg-accent/5 hover:text-accent"
        >
          + Add schedule
        </button>
        <div className="flex items-center gap-3">
          {error && <span className="text-xs text-danger">{error}</span>}
          {savedAt && !error && !isDirty && (
            <span className="text-xs text-success">Saved.</span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving || !isDirty}
            className="btn-primary btn-sm"
          >
            {saving ? "Saving…" : isDirty ? "Save schedules" : "Saved"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScheduleRow({
  entry,
  lanes,
  onUpdate,
  onRemove,
}: {
  entry: ScheduleEntry;
  lanes: BrandLaneOption[];
  onUpdate: (patch: Partial<ScheduleEntry>) => void;
  onRemove: () => void;
}) {
  const youtube = entry.platforms.includes("youtube");
  const tiktok = entry.platforms.includes("tiktok");
  const filteredLanes = entry.laneType
    ? lanes.filter((l) => l.type === entry.laneType)
    : lanes;

  function setPlatform(p: "youtube" | "tiktok", on: boolean) {
    const set = new Set(entry.platforms);
    if (on) set.add(p);
    else set.delete(p);
    onUpdate({ platforms: [...set] });
  }

  return (
    <article className="card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={entry.enabled}
            onChange={(e) => onUpdate({ enabled: e.target.checked })}
            className="size-4 rounded border-border bg-surface"
          />
          <span className="text-xs font-medium text-fg-muted">Enabled</span>
        </label>
        <input
          value={entry.name ?? ""}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Schedule name (e.g. Reddit morning)"
          className="input input-sm flex-1 min-w-[8rem]"
          aria-label="Schedule name"
        />
        <button
          type="button"
          onClick={onRemove}
          className="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium text-fg-subtle hover:bg-surface-3 hover:text-danger"
          aria-label="Delete schedule"
        >
          Delete
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="label">Cron</span>
          <input
            type="text"
            value={entry.cron}
            onChange={(e) => onUpdate({ cron: e.target.value })}
            placeholder="0 11,15,19 * * *"
            className="input input-sm mt-1.5 font-mono"
          />
        </label>
        <label className="block">
          <span className="label">Video type</span>
          <select
            value={entry.laneType ?? "any"}
            onChange={(e) => {
              const v = e.target.value;
              const next = v === "any" ? null : (v as ScheduleLaneType);
              // If the current lane doesn't match the new type, clear it.
              const sameType = next === null || lanes.find((l) => l.id === entry.lane)?.type === next;
              onUpdate({ laneType: next, lane: sameType ? entry.lane : null });
            }}
            className="input input-sm mt-1.5"
          >
            <option value="any">Any</option>
            <option value="pexels-api">Topic-driven</option>
            <option value="reddit-story">Reddit story</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Lane</span>
          <select
            value={entry.lane ?? ""}
            onChange={(e) => onUpdate({ lane: e.target.value || null })}
            className="input input-sm mt-1.5"
          >
            <option value="">
              {entry.laneType
                ? `(any ${TYPE_LABEL[entry.laneType].toLowerCase()} lane)`
                : "(any lane)"}
            </option>
            {filteredLanes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 pt-4">
        <Check label="Upload to YouTube" checked={youtube} onChange={(v) => setPlatform("youtube", v)} disabled={entry.dryRun} />
        <Check label="Upload to TikTok" checked={tiktok} onChange={(v) => setPlatform("tiktok", v)} disabled={entry.dryRun} />
        <Check label="Dry run" checked={entry.dryRun} onChange={(v) => onUpdate({ dryRun: v })} />
        <Check
          label="Skip if a job is already running"
          checked={entry.skipIfRunning}
          onChange={(v) => onUpdate({ skipIfRunning: v })}
        />
      </fieldset>

      {entry.lastRunAt && (
        <div className="mt-3 text-[11px] text-fg-subtle">
          Last run: <span className="font-mono">{new Date(entry.lastRunAt).toLocaleString()}</span>
        </div>
      )}
    </article>
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
        (disabled
          ? "cursor-not-allowed text-fg-subtle"
          : "cursor-pointer text-fg-muted hover:text-fg")
      }
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-border bg-surface"
        disabled={disabled}
      />
      {label}
    </label>
  );
}
