"use client";

import type {
  CommentTone,
  ContentLane,
  RedditLaneConfig,
  SubredditConfig,
} from "@pipeline/domain/models";
import { TagInput } from "@/components/TagInput";

function SubredditList({
  value,
  onChange,
}: {
  value: SubredditConfig[];
  onChange: (next: SubredditConfig[]) => void;
}) {
  function update(idx: number, patch: Partial<SubredditConfig>) {
    onChange(value.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...value, { name: "", showDescription: false, commentTone: "blend" }]);
  }
  return (
    <div className="space-y-2">
      {value.length === 0 ? (
        <div className="text-xs text-fg-subtle">
          No subreddits yet. Add one to start picking posts from it.
        </div>
      ) : null}
      {value.map((sub, i) => (
        <div
          key={i}
          className="flex flex-wrap items-end gap-2 rounded-md border border-border/60 bg-surface-2/40 p-2"
        >
          <label className="flex-1 min-w-[140px] block">
            <span className="label text-[11px]">r/</span>
            <input
              value={sub.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="AskReddit"
              className="input input-sm mt-1 font-mono"
            />
          </label>
          <label className="flex items-center gap-1.5 pb-1.5 text-xs text-fg-muted">
            <input
              type="checkbox"
              checked={sub.showDescription === true}
              onChange={(e) => update(i, { showDescription: e.target.checked })}
              className="h-3.5 w-3.5"
            />
            Read post body
          </label>
          <label className="block">
            <span className="label text-[11px]">Tone</span>
            <select
              value={sub.commentTone ?? "blend"}
              onChange={(e) => update(i, { commentTone: e.target.value as CommentTone })}
              className="input input-sm mt-1"
            >
              <option value="funny">funny</option>
              <option value="sincere">sincere</option>
              <option value="blend">blend</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => remove(i)}
            className="pb-1.5 text-xs font-medium text-fg-subtle hover:text-danger"
            aria-label={`Remove r/${sub.name || "subreddit"}`}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full rounded-md border border-dashed border-border/70 bg-surface/30 px-2 py-1.5 text-xs font-medium text-fg-muted hover:border-accent/40 hover:bg-accent/5 hover:text-accent"
      >
        + Add subreddit
      </button>
    </div>
  );
}

/**
 * Editor for the contentLanes[] array on a ChannelProfile.
 *
 * Each lane is a card with id, description, target duration, and a
 * chip-tag input for example hooks. Reorder is done with explicit
 * up/down buttons (no drag library — we want zero deps for this
 * minimalist UI). Add appends a fresh empty lane; delete removes
 * the card from the array.
 *
 * Lane order matters: the pipeline picks lanes by id but the
 * persisted order is preserved for display and for the random-pick
 * fallback in src/generate.ts.
 */
export interface ContentLanesEditorProps {
  value: ContentLane[];
  onChange: (next: ContentLane[]) => void;
}

export function ContentLanesEditor({ value, onChange }: ContentLanesEditorProps) {
  function update(idx: number, patch: Partial<ContentLane>) {
    onChange(value.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function updateRedditConfig(idx: number, patch: Partial<RedditLaneConfig>) {
    const lane = value[idx];
    const next: RedditLaneConfig = { subreddits: [], ...(lane.redditConfig ?? {}), ...patch };
    update(idx, { redditConfig: next });
  }

  function move(idx: number, delta: -1 | 1) {
    const next = idx + delta;
    if (next < 0 || next >= value.length) return;
    const arr = value.slice();
    const [item] = arr.splice(idx, 1);
    arr.splice(next, 0, item);
    onChange(arr);
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function add() {
    onChange([
      ...value,
      {
        id: `lane-${value.length + 1}`,
        description: "",
        targetDurationSeconds: 35,
        exampleHooks: [],
      },
    ]);
  }

  return (
    <div className="space-y-3">
      {value.map((lane, idx) => (
        <div key={idx} className="rounded-lg border border-border bg-surface-2/60 p-4">
          <div className="flex items-start gap-3">
            <div className="flex flex-col gap-1 pt-1">
              <button
                type="button"
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
                className="grid h-6 w-6 place-items-center rounded text-xs text-fg-subtle hover:bg-surface-3 hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Move up"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(idx, +1)}
                disabled={idx === value.length - 1}
                className="grid h-6 w-6 place-items-center rounded text-xs text-fg-subtle hover:bg-surface-3 hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Move down"
              >
                ▼
              </button>
            </div>
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-4 gap-3">
                <label className="col-span-2 block">
                  <span className="label">Lane id</span>
                  <input
                    value={lane.id}
                    onChange={(e) => update(idx, { id: e.target.value })}
                    className="input input-sm mt-1.5 font-mono"
                  />
                </label>
                <label className="block">
                  <span className="label">Type</span>
                  <select
                    value={lane.type ?? "pexels-api"}
                    onChange={(e) =>
                      update(idx, { type: e.target.value as ContentLane["type"] })
                    }
                    className="input input-sm mt-1.5"
                  >
                    <option value="pexels-api">pexels-api</option>
                    <option value="reddit-story">reddit-story</option>
                  </select>
                </label>
                <label className="block">
                  <span className="label">Target seconds</span>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={lane.targetDurationSeconds}
                    onChange={(e) =>
                      update(idx, { targetDurationSeconds: Number(e.target.value) || 0 })
                    }
                    className="input input-sm mt-1.5"
                  />
                </label>
              </div>
              <label className="block">
                <span className="label">Description</span>
                <textarea
                  rows={2}
                  value={lane.description}
                  onChange={(e) => update(idx, { description: e.target.value })}
                  className="input input-sm mt-1.5"
                />
              </label>
              <div className="block">
                <span className="label">Example hooks</span>
                <div className="mt-1.5">
                  <TagInput
                    value={lane.exampleHooks ?? []}
                    onChange={(hooks) => update(idx, { exampleHooks: hooks })}
                    placeholder="Add an example hook…"
                  />
                </div>
              </div>
              {lane.type === "reddit-story" && (
                <div className="rounded-md border border-border/70 bg-surface/30 p-3 space-y-3">
                  <div className="text-xs font-semibold text-fg-subtle">Reddit story config</div>
                  <div>
                    <span className="label">Subreddits</span>
                    <div className="mt-1.5">
                      <SubredditList
                        value={lane.redditConfig?.subreddits ?? []}
                        onChange={(subs) => updateRedditConfig(idx, { subreddits: subs })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <label className="block">
                      <span className="label">Time range</span>
                      <select
                        value={lane.redditConfig?.timeRange ?? "week"}
                        onChange={(e) =>
                          updateRedditConfig(idx, {
                            timeRange: e.target.value as RedditLaneConfig["timeRange"],
                          })
                        }
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
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={lane.redditConfig?.commentCount ?? 5}
                        onChange={(e) =>
                          updateRedditConfig(idx, {
                            commentCount: Number(e.target.value) || 5,
                          })
                        }
                        className="input input-sm mt-1.5"
                      />
                    </label>
                    <label className="block">
                      <span className="label">Min len</span>
                      <input
                        type="number"
                        min={0}
                        value={lane.redditConfig?.minCommentLength ?? 80}
                        onChange={(e) =>
                          updateRedditConfig(idx, {
                            minCommentLength: Number(e.target.value) || 0,
                          })
                        }
                        className="input input-sm mt-1.5"
                      />
                    </label>
                    <label className="block">
                      <span className="label">Max len</span>
                      <input
                        type="number"
                        min={1}
                        value={lane.redditConfig?.maxCommentLength ?? 600}
                        onChange={(e) =>
                          updateRedditConfig(idx, {
                            maxCommentLength: Number(e.target.value) || 600,
                          })
                        }
                        className="input input-sm mt-1.5"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="block">
                      <span className="label">Default tone</span>
                      <select
                        value={lane.redditConfig?.commentTone ?? "blend"}
                        onChange={(e) =>
                          updateRedditConfig(idx, {
                            commentTone: e.target.value as CommentTone,
                          })
                        }
                        className="input input-sm mt-1.5"
                      >
                        <option value="funny">funny</option>
                        <option value="sincere">sincere</option>
                        <option value="blend">blend</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="label">Card reveal</span>
                      <select
                        value={lane.redditConfig?.cardInitialReveal ?? "empty"}
                        onChange={(e) =>
                          updateRedditConfig(idx, {
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
                      <input
                        type="number"
                        min={400}
                        max={1700}
                        value={lane.redditConfig?.cardMaxHeightPx ?? 1100}
                        onChange={(e) =>
                          updateRedditConfig(idx, {
                            cardMaxHeightPx: Number(e.target.value) || 1100,
                          })
                        }
                        className="input input-sm mt-1.5"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => remove(idx)}
              className="text-xs font-medium text-fg-subtle hover:text-danger"
              aria-label="Delete lane"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full rounded-lg border border-dashed border-border bg-surface/40 px-3 py-3 text-xs font-medium text-fg-muted transition-colors hover:border-accent/40 hover:bg-accent/5 hover:text-accent"
      >
        + Add lane
      </button>
    </div>
  );
}
