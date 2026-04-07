"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Manual trigger form for /runs. Renders a brand dropdown, lane
 * dropdown (filtered to the selected brand's lanes), dry-run toggle,
 * and per-platform upload checkboxes. POSTs to /api/runs and on
 * success navigates to /runs/[jobId] where the SSE stream takes over.
 */

export interface TriggerBrandOption {
  id: string;
  displayName: string;
  lanes: { id: string; description: string }[];
}

export function TriggerRunForm({ brands }: { brands: TriggerBrandOption[] }) {
  const router = useRouter();
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [lane, setLane] = useState<string>("");
  const [dryRun, setDryRun] = useState(false);
  const [youtube, setYoutube] = useState(false);
  const [tiktok, setTiktok] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === brandId),
    [brands, brandId],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!brandId) {
      setError("Pick a brand");
      return;
    }
    const platforms: string[] = [];
    if (youtube) platforms.push("youtube");
    if (tiktok) platforms.push("tiktok");

    const res = await fetch("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        brandId,
        lane: lane || null,
        dryRun,
        platforms,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? `HTTP ${res.status}`);
      return;
    }
    const data = (await res.json()) as { jobId: string };
    startTransition(() => {
      router.push(`/runs/${data.jobId}`);
      router.refresh();
    });
  }

  if (brands.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface/60 px-4 py-10 text-center text-xs text-fg-muted">
        No brands configured.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Brand</span>
          <select
            className="input input-sm mt-1.5"
            value={brandId}
            onChange={(e) => {
              setBrandId(e.target.value);
              setLane("");
            }}
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName} ({b.id})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Lane</span>
          <select
            className="input input-sm mt-1.5"
            value={lane}
            onChange={(e) => setLane(e.target.value)}
          >
            <option value="">(any — pipeline picks one)</option>
            {selectedBrand?.lanes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Check label="Dry run (script only)" checked={dryRun} onChange={setDryRun} />
        <Check label="Upload to YouTube" checked={youtube} onChange={setYoutube} disabled={dryRun} />
        <Check label="Upload to TikTok" checked={tiktok} onChange={setTiktok} disabled={dryRun} />
      </fieldset>

      {error && <div className="alert-error">{error}</div>}

      <div className="flex items-center justify-end">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Starting…" : "Start run"}
        </button>
      </div>
    </form>
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
