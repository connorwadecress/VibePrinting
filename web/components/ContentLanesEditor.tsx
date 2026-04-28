"use client";

import type { ContentLane } from "@pipeline/domain/models";
import { TagInput } from "@/components/TagInput";

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
                    value={lane.type ?? "seven-api"}
                    onChange={(e) =>
                      update(idx, { type: e.target.value as ContentLane["type"] })
                    }
                    className="input input-sm mt-1.5"
                  >
                    <option value="seven-api">seven-api</option>
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
