"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Manual trigger form for /runs.
 *
 * Flow: pick lane type → pick lane (filtered by type) → optional topic
 * seed → upload toggles (on by default). POSTs to /api/runs and on
 * success navigates to /runs/[jobId] where the SSE stream takes over.
 */

type LaneType = "pexels-api" | "reddit-story";

export interface TriggerLaneOption {
  id: string;
  description: string;
  type: LaneType;
}

export interface TriggerBrandOption {
  id: string;
  displayName: string;
  lanes: TriggerLaneOption[];
}

const TYPE_LABEL: Record<LaneType, string> = {
  "pexels-api": "Topic-driven",
  "reddit-story": "Reddit story",
};

const TYPE_HELP: Record<LaneType, string> = {
  "pexels-api":
    "AI picks a topic from the lane and assembles stock footage from Pexels.",
  "reddit-story":
    "Picks a top post from your subreddits and plays it over your gameplay library.",
};

const SEED_PLACEHOLDER: Record<LaneType, string> = {
  "pexels-api": "Optional — a topic phrase to skip topic discovery",
  "reddit-story": "Optional — a Reddit post URL to skip subreddit picking",
};

const SEED_HELP: Record<LaneType, string> = {
  "pexels-api": "Sets VP_TOPIC_SEED. The lane's research stage uses this verbatim instead of the LLM-picked topic.",
  "reddit-story": "Sets VP_REDDIT_POST_URL. Must be a full Reddit permalink to a post.",
};

export function TriggerRunForm({ brands }: { brands: TriggerBrandOption[] }) {
  const router = useRouter();
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [laneType, setLaneType] = useState<LaneType>("pexels-api");
  const [lane, setLane] = useState<string>("");
  const [topicSeed, setTopicSeed] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [youtube, setYoutube] = useState(true);
  const [tiktok, setTiktok] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === brandId),
    [brands, brandId],
  );

  const filteredLanes = useMemo(
    () => (selectedBrand?.lanes ?? []).filter((l) => l.type === laneType),
    [selectedBrand, laneType],
  );

  async function submit(opts: { surpriseMe?: boolean } = {}) {
    setError(null);
    if (!brandId) {
      setError("Pick a brand");
      return;
    }
    const trimmedSeed = topicSeed.trim();
    if (trimmedSeed && !lane) {
      setError("Topic seed requires a specific lane (not 'any')");
      return;
    }
    if (opts.surpriseMe && (lane || trimmedSeed)) {
      setError("Surprise me ignores lane + seed — clear them first");
      return;
    }
    const platforms: string[] = [];
    if (!dryRun) {
      if (youtube) platforms.push("youtube");
      if (tiktok) platforms.push("tiktok");
    }

    // When the user picks "any" within a lane-type tab, we still want
    // the pipeline to pick from THAT type only. Send laneType so the
    // child gets --lane-type=<t>. "Surprise me" omits laneType so the
    // pipeline picks randomly across all lane types on the brand.
    const sendLaneType = !opts.surpriseMe && !lane;

    const res = await fetch("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        brandId,
        lane: lane || null,
        laneType: sendLaneType ? laneType : null,
        dryRun,
        platforms,
        topicSeed: trimmedSeed || null,
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

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submit();
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
      {brands.length > 1 && (
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
      )}

      <div>
        <span className="label">Lane type</span>
        <div
          role="radiogroup"
          aria-label="Lane type"
          className="mt-1.5 inline-flex rounded-md border border-border bg-surface-2/40 p-0.5"
        >
          {(["pexels-api", "reddit-story"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={laneType === t}
              onClick={() => {
                setLaneType(t);
                setLane("");
                setTopicSeed("");
              }}
              className={
                "cursor-pointer rounded px-3 py-1.5 text-xs font-medium transition-colors " +
                (laneType === t
                  ? "bg-surface-3 text-fg"
                  : "text-fg-muted hover:text-fg")
              }
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-fg-subtle">{TYPE_HELP[laneType]}</p>
      </div>

      <label className="block">
        <span className="label">Lane</span>
        <select
          className="input input-sm mt-1.5"
          value={lane}
          onChange={(e) => setLane(e.target.value)}
        >
          <option value="">
            (any {TYPE_LABEL[laneType].toLowerCase()} lane — pipeline picks one)
          </option>
          {filteredLanes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.id}
            </option>
          ))}
        </select>
        {filteredLanes.length === 0 ? (
          <p className="mt-1.5 text-xs text-fg-subtle">
            This brand has no {TYPE_LABEL[laneType].toLowerCase()} lanes — switch type or add one in the brand editor.
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-fg-subtle">
            &quot;Any&quot; restricts to {TYPE_LABEL[laneType].toLowerCase()} lanes only. Use{" "}
            <em>Surprise me</em> below to pick across all lane types.
          </p>
        )}
      </label>

      <label className="block">
        <span className="label">Topic seed</span>
        <input
          type="text"
          className="input input-sm mt-1.5"
          value={topicSeed}
          onChange={(e) => setTopicSeed(e.target.value)}
          placeholder={SEED_PLACEHOLDER[laneType]}
        />
        <p className="mt-1.5 text-xs text-fg-subtle">{SEED_HELP[laneType]}</p>
      </label>

      <fieldset className="space-y-2 border-t border-border/60 pt-4">
        <legend className="label mb-1">Output</legend>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Check label="Upload to YouTube" checked={youtube} onChange={setYoutube} disabled={dryRun} />
          <Check label="Upload to TikTok" checked={tiktok} onChange={setTiktok} disabled={dryRun} />
        </div>
        <div>
          <Check label="Dry run (script only — no video, no upload)" checked={dryRun} onChange={setDryRun} />
        </div>
      </fieldset>

      {error && <div className="alert-error">{error}</div>}

      <div className="flex flex-col-reverse items-stretch justify-end gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={pending || !!lane || !!topicSeed.trim()}
          onClick={() => void submit({ surpriseMe: true })}
          title={
            lane || topicSeed.trim()
              ? "Clear the lane + topic seed to use Surprise me"
              : "Pick a random lane across ALL lane types on this brand"
          }
          className="btn-secondary"
        >
          🎲 Surprise me (any lane)
        </button>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Starting…" : `Start ${TYPE_LABEL[laneType].toLowerCase()} run`}
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
        "flex cursor-pointer items-center gap-2 text-sm " +
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
