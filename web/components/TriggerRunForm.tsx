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
      <div className="rounded-md border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-xs text-neutral-500">
        No brands configured.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-md border border-neutral-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-700">Brand</span>
          <select
            className="block w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm"
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
          <span className="mb-1 block text-xs font-medium text-neutral-700">Lane</span>
          <select
            className="block w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm"
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
        <label className="flex items-center gap-2 text-sm text-neutral-800">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="h-4 w-4"
          />
          Dry run (script only)
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-800">
          <input
            type="checkbox"
            checked={youtube}
            onChange={(e) => setYoutube(e.target.checked)}
            className="h-4 w-4"
            disabled={dryRun}
          />
          Upload to YouTube
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-800">
          <input
            type="checkbox"
            checked={tiktok}
            onChange={(e) => setTiktok(e.target.checked)}
            className="h-4 w-4"
            disabled={dryRun}
          />
          Upload to TikTok
        </label>
      </fieldset>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {pending ? "Starting…" : "Start run"}
        </button>
      </div>
    </form>
  );
}
