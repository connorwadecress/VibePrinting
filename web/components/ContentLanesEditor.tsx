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
        <div key={idx} className="rounded-md border border-neutral-200 bg-white p-3">
          <div className="flex items-start gap-3">
            <div className="flex flex-col gap-1 pt-1">
              <button
                type="button"
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
                className="text-xs text-neutral-400 hover:text-neutral-700 disabled:cursor-not-allowed disabled:text-neutral-200"
                aria-label="Move up"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(idx, +1)}
                disabled={idx === value.length - 1}
                className="text-xs text-neutral-400 hover:text-neutral-700 disabled:cursor-not-allowed disabled:text-neutral-200"
                aria-label="Move down"
              >
                ▼
              </button>
            </div>
            <div className="flex-1 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <label className="col-span-2 block">
                  <span className="text-xs font-medium text-neutral-700">Lane id</span>
                  <input
                    value={lane.id}
                    onChange={(e) => update(idx, { id: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1 font-mono text-xs text-neutral-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-neutral-700">Target seconds</span>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={lane.targetDurationSeconds}
                    onChange={(e) =>
                      update(idx, { targetDurationSeconds: Number(e.target.value) || 0 })
                    }
                    className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-neutral-700">Description</span>
                <textarea
                  rows={2}
                  value={lane.description}
                  onChange={(e) => update(idx, { description: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </label>
              <div className="block">
                <span className="text-xs font-medium text-neutral-700">Example hooks</span>
                <div className="mt-1">
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
              className="text-xs text-neutral-400 hover:text-red-600"
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
        className="w-full rounded-md border border-dashed border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-600 hover:border-indigo-300 hover:text-indigo-700"
      >
        + Add lane
      </button>
    </div>
  );
}
