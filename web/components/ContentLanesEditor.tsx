"use client";

import { useState } from "react";
import type {
  CommentTone,
  ContentLane,
  LaneType,
  RedditLaneConfig,
  TrimPriority,
} from "@pipeline/domain/models";
import { TagInput } from "@/components/TagInput";
import { NumberInput } from "@/components/NumberInput";

/**
 * Editor for one slice of the contentLanes[] array on a ChannelProfile,
 * filtered to a single lane type. The parent (BrandForm) splits lanes
 * by type and renders one editor per group.
 *
 * Lane cards are collapsed by default — header shows id, summary, and
 * delete. Click the row to expand the full editor inline. Newly-added
 * lanes auto-expand so you can fill them in. Structural edits (move,
 * remove) collapse everything to keep the position-based expansion
 * state consistent.
 */
export interface ContentLanesEditorProps {
  laneType: LaneType;
  value: ContentLane[];
  onChange: (next: ContentLane[]) => void;
}

const SCAFFOLD: Record<LaneType, (n: number) => ContentLane> = {
  "pexels-api": (n) => ({
    id: `lane-${n}`,
    description: "",
    targetDurationSeconds: 35,
    exampleHooks: [],
    type: "pexels-api",
  }),
  "reddit-story": (n) => ({
    id: `reddit-${n}`,
    description: "",
    targetDurationSeconds: 60,
    exampleHooks: [],
    type: "reddit-story",
    redditConfig: {
      subreddit: "",
      showDescription: false,
      commentTone: "blend",
      timeRange: "week",
      commentCount: 5,
      minCommentLength: 80,
      maxCommentLength: 600,
      cardInitialReveal: "empty",
      cardMaxHeightPx: 1100,
    },
  }),
};

export function ContentLanesEditor({ laneType, value, onChange }: ContentLanesEditorProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const isReddit = laneType === "reddit-story";

  function update(idx: number, patch: Partial<ContentLane>) {
    onChange(value.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function updateRedditConfig(idx: number, patch: Partial<RedditLaneConfig>) {
    const lane = value[idx];
    const next: RedditLaneConfig = { subreddit: "", ...(lane.redditConfig ?? {}), ...patch };
    update(idx, { redditConfig: next });
  }

  function move(idx: number, delta: -1 | 1) {
    const next = idx + delta;
    if (next < 0 || next >= value.length) return;
    const arr = value.slice();
    const [item] = arr.splice(idx, 1);
    arr.splice(next, 0, item);
    setExpandedIdx(null);
    onChange(arr);
  }

  function remove(idx: number) {
    setExpandedIdx(null);
    onChange(value.filter((_, i) => i !== idx));
  }

  function add() {
    const next = [...value, SCAFFOLD[laneType](value.length + 1)];
    setExpandedIdx(next.length - 1);
    onChange(next);
  }

  function toggle(idx: number) {
    setExpandedIdx((cur) => (cur === idx ? null : idx));
  }

  return (
    <div className="space-y-2">
      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface/40 px-4 py-8 text-center text-xs text-fg-subtle">
          No {isReddit ? "Reddit story" : "topic-driven"} lanes yet.
        </div>
      ) : null}
      {value.map((lane, idx) => (
        <LaneCard
          key={idx}
          lane={lane}
          idx={idx}
          total={value.length}
          isReddit={isReddit}
          expanded={expandedIdx === idx}
          onToggle={() => toggle(idx)}
          onUpdate={(patch) => update(idx, patch)}
          onUpdateRedditConfig={(patch) => updateRedditConfig(idx, patch)}
          onMove={(delta) => move(idx, delta)}
          onRemove={() => remove(idx)}
        />
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full cursor-pointer rounded-lg border border-dashed border-border bg-surface/40 px-3 py-2.5 text-xs font-medium text-fg-muted transition-colors hover:border-accent/40 hover:bg-accent/5 hover:text-accent"
      >
        + Add {isReddit ? "subreddit lane" : "topic-driven lane"}
      </button>
    </div>
  );
}

interface LaneCardProps {
  lane: ContentLane;
  idx: number;
  total: number;
  isReddit: boolean;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<ContentLane>) => void;
  onUpdateRedditConfig: (patch: Partial<RedditLaneConfig>) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}

function LaneCard({
  lane,
  idx,
  total,
  isReddit,
  expanded,
  onToggle,
  onUpdate,
  onUpdateRedditConfig,
  onMove,
  onRemove,
}: LaneCardProps) {
  const summary = isReddit
    ? laneSubredditSummary(lane.redditConfig)
    : laneDescriptionSummary(lane.description);

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-surface-2/60">
      <div
        className={
          "flex items-center gap-2 px-2 py-1.5 transition-colors " +
          (expanded ? "border-b border-border/60 bg-surface-2/80" : "hover:bg-surface-2/80")
        }
      >
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={idx === 0}
            className="grid size-4 cursor-pointer place-items-center rounded text-[10px] text-fg-subtle hover:bg-surface-3 hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Move up"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => onMove(+1)}
            disabled={idx === total - 1}
            className="grid size-4 cursor-pointer place-items-center rounded text-[10px] text-fg-subtle hover:bg-surface-3 hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Move down"
          >
            ▼
          </button>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="grid size-6 shrink-0 cursor-pointer place-items-center rounded text-fg-subtle hover:bg-surface-3 hover:text-fg"
          aria-label={expanded ? "Collapse lane" : "Expand lane"}
          aria-expanded={expanded}
        >
          <span className={"transition-transform " + (expanded ? "rotate-90" : "")}>▶</span>
        </button>

        <input
          value={lane.id}
          onChange={(e) => onUpdate({ id: e.target.value })}
          className="input input-sm w-32 shrink-0 font-mono"
          placeholder={isReddit ? "subreddit-id" : "lane-id"}
          aria-label="Lane id"
          onClick={(e) => e.stopPropagation()}
        />

        <button
          type="button"
          onClick={onToggle}
          className="flex-1 cursor-pointer truncate text-left text-xs text-fg-subtle hover:text-fg-muted"
          title={summary || "(empty)"}
        >
          {summary || <span className="italic">(no {isReddit ? "subreddit" : "description"})</span>}
        </button>

        <label className="flex shrink-0 items-center gap-1.5">
          <NumberInput
            min={5}
            max={120}
            value={lane.targetDurationSeconds}
            onChange={(v) => onUpdate({ targetDurationSeconds: v ?? 0 })}
            className="input input-sm w-16"
            ariaLabel="Target duration in seconds"
            onClick={(e) => e.stopPropagation()}
          />
          <span className="text-xs text-fg-subtle">sec</span>
        </label>

        <button
          type="button"
          onClick={onRemove}
          className="cursor-pointer rounded px-2 py-1 text-xs font-medium text-fg-subtle hover:bg-surface-3 hover:text-danger"
          aria-label="Delete lane"
        >
          Delete
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 p-3">
          <label className="block">
            <span className="label">Description</span>
            <textarea
              rows={2}
              value={lane.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              className="input input-sm mt-1.5"
              placeholder={
                isReddit
                  ? "What this lane is for, e.g. \"AskReddit comment compilations\"."
                  : "What this lane is for — guides the LLM topic discovery."
              }
            />
          </label>

          {!isReddit && (
            <div className="block">
              <span className="label">Example hooks</span>
              <div className="mt-1.5">
                <TagInput
                  value={lane.exampleHooks ?? []}
                  onChange={(hooks) => onUpdate({ exampleHooks: hooks })}
                  placeholder="Add an example hook…"
                />
              </div>
            </div>
          )}

          {isReddit && <RedditConfigBody lane={lane} onUpdate={onUpdateRedditConfig} />}
        </div>
      )}
    </article>
  );
}

function RedditConfigBody({
  lane,
  onUpdate,
}: {
  lane: ContentLane;
  onUpdate: (patch: Partial<RedditLaneConfig>) => void;
}) {
  const cfg = lane.redditConfig;
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <label className="col-span-2 block">
          <span className="label">Subreddit</span>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-fg-subtle">r/</span>
            <input
              value={cfg?.subreddit ?? ""}
              onChange={(e) => onUpdate({ subreddit: e.target.value })}
              placeholder="AskReddit"
              className="input input-sm font-mono"
            />
          </div>
        </label>
        <label className="block">
          <span className="label">Tone</span>
          <select
            value={cfg?.commentTone ?? "blend"}
            onChange={(e) => onUpdate({ commentTone: e.target.value as CommentTone })}
            className="input input-sm mt-1.5"
          >
            <option value="funny">funny</option>
            <option value="sincere">sincere</option>
            <option value="blend">blend</option>
          </select>
        </label>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-muted">
        <input
          type="checkbox"
          checked={cfg?.showDescription === true}
          onChange={(e) => onUpdate({ showDescription: e.target.checked })}
          className="h-4 w-4 rounded border-border bg-surface"
        />
        Read the post body aloud (use for r/tifu, r/AmItheAsshole)
      </label>

      <div className="grid grid-cols-4 gap-3">
        <label className="block">
          <span className="label">Time range</span>
          <select
            value={cfg?.timeRange ?? "week"}
            onChange={(e) => onUpdate({ timeRange: e.target.value as RedditLaneConfig["timeRange"] })}
            className="input input-sm mt-1.5"
          >
            <option value="day">day</option>
            <option value="week">week</option>
            <option value="month">month</option>
            <option value="year">year</option>
            <option value="all">all</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Comments</span>
          <NumberInput
            min={1}
            max={20}
            value={cfg?.commentCount}
            onChange={(v) => onUpdate({ commentCount: v })}
            className="input input-sm mt-1.5"
            placeholder="5"
          />
        </label>
        <label className="block">
          <span className="label">Min len</span>
          <NumberInput
            min={0}
            value={cfg?.minCommentLength}
            onChange={(v) => onUpdate({ minCommentLength: v })}
            className="input input-sm mt-1.5"
            placeholder="80"
          />
        </label>
        <label className="block">
          <span className="label">Max len</span>
          <NumberInput
            min={1}
            value={cfg?.maxCommentLength}
            onChange={(v) => onUpdate({ maxCommentLength: v })}
            className="input input-sm mt-1.5"
            placeholder="600"
          />
        </label>
      </div>

      <div className="rounded-md border border-border/60 bg-surface/30 p-3 space-y-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          If the script is longer than the target
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Trim priority</span>
            <select
              value={cfg?.trimPriority ?? "balanced"}
              onChange={(e) => onUpdate({ trimPriority: e.target.value as TrimPriority })}
              className="input input-sm mt-1.5"
            >
              <option value="balanced">balanced — drop trailing comments, then body</option>
              <option value="comments">comments — drop comments first (body is the story)</option>
              <option value="body">body — drop body first (comments are the story)</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Max speed-up % (last resort)</span>
            <NumberInput
              min={0}
              max={50}
              step={5}
              value={cfg?.maxSpeedupPercent}
              onChange={(v) => onUpdate({ maxSpeedupPercent: v })}
              className="input input-sm mt-1.5"
              placeholder="0"
            />
          </label>
        </div>
        <p className="text-[11px] text-fg-subtle">
          Trim drops content first; speed-up nudges the TTS rate as a fallback. 0% disables speed-up.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Card reveal</span>
          <select
            value={cfg?.cardInitialReveal ?? "empty"}
            onChange={(e) =>
              onUpdate({
                cardInitialReveal: e.target.value as RedditLaneConfig["cardInitialReveal"],
              })
            }
            className="input input-sm mt-1.5"
          >
            <option value="empty">empty (fills word-by-word)</option>
            <option value="first-sentence">first sentence pre-rendered</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Card max height (px)</span>
          <NumberInput
            min={400}
            max={1700}
            value={cfg?.cardMaxHeightPx}
            onChange={(v) => onUpdate({ cardMaxHeightPx: v })}
            className="input input-sm mt-1.5"
            placeholder="1100"
          />
        </label>
      </div>

      <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 bg-surface/30 px-3 py-2.5 text-sm text-fg-muted">
        <input
          type="checkbox"
          checked={cfg?.commentVoiceRotation !== false}
          onChange={(e) =>
            onUpdate({ commentVoiceRotation: e.target.checked ? undefined : false })
          }
          className="mt-0.5 h-4 w-4 rounded border-border bg-surface"
        />
        <span className="space-y-1">
          <span className="block">Rotate voices on comments for this lane</span>
          <span className="block text-[11px] text-fg-subtle">
            Uses the channel-level voice pool + mode (configured under{" "}
            <em>Voiceover &rarr; Comment voice rotation</em>). Uncheck to force a single
            narrator voice for this subreddit, even if the channel has a pool.
          </span>
        </span>
      </label>
    </>
  );
}

function laneDescriptionSummary(description: string): string {
  const trimmed = description.trim();
  if (!trimmed) return "";
  return trimmed.length > 100 ? trimmed.slice(0, 97) + "…" : trimmed;
}

function laneSubredditSummary(cfg: RedditLaneConfig | undefined): string {
  const sub = cfg?.subreddit?.trim();
  if (!sub) return "";
  const tone = cfg?.commentTone ?? "blend";
  const body = cfg?.showDescription ? " · body" : "";
  return `r/${sub} · ${tone}${body}`;
}
