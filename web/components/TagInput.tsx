"use client";

import { useState, type KeyboardEvent } from "react";

/**
 * Minimal chip-tag input. Press Enter or comma to add a tag, click
 * the × on a chip to remove it. Used for tags, hashtags, example
 * hooks, blockedReasons, and publishSlots.
 *
 * Optional `validate` lets the parent reject malformed entries
 * (e.g. require a leading "#" for hashtags).
 */
export interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  validate?: (raw: string) => string | null; // returns normalized value or null to reject
  ariaLabel?: string;
}

export function TagInput({ value, onChange, placeholder, validate, ariaLabel }: TagInputProps) {
  const [draft, setDraft] = useState("");

  function commit() {
    const raw = draft.trim();
    if (!raw) return;
    const normalized = validate ? validate(raw) : raw;
    if (!normalized) {
      setDraft("");
      return;
    }
    if (value.includes(normalized)) {
      setDraft("");
      return;
    }
    onChange([...value, normalized]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2 py-1.5 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500"
      aria-label={ariaLabel}
    >
      {value.map((tag, idx) => (
        <span
          key={`${tag}-${idx}`}
          className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-800"
        >
          <span className="font-mono">{tag}</span>
          <button
            type="button"
            onClick={() => remove(idx)}
            className="text-neutral-400 hover:text-red-600"
            aria-label={`Remove ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={placeholder ?? "Add…"}
        className="min-w-[6rem] flex-1 bg-transparent px-1 py-0.5 text-xs text-neutral-900 outline-none placeholder:text-neutral-400"
      />
    </div>
  );
}
