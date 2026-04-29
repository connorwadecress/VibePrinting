"use client";

import { useEffect, useState } from "react";

/**
 * Numeric input that lets the user freely type, backspace, and clear
 * the field without snapping back to a default mid-edit. Plain
 * `<input type="number" value={n} onChange={e => set(Number(e.target.value) || fallback)} />`
 * snaps because `Number("")` is `0` (falsy) so the `|| fallback` branch
 * fires immediately when the field is emptied.
 *
 * Behavior:
 *  - Input is bound to a local string draft so the user can type freely.
 *  - Empty draft commits `undefined` to the parent (parent decides what
 *    that means — usually omitting the field from JSON so the engine
 *    falls back to its default).
 *  - Non-numeric drafts (e.g. mid-typing `-`) don't commit anything until
 *    a valid number is entered.
 *  - `min`/`max` are passed through to the native input as soft hints
 *    (browser arrows respect them) but we do NOT clamp on every keystroke.
 *  - When the parent changes `value` externally (Discard, schema reset,
 *    etc.), the draft re-syncs.
 */
export interface NumberInputProps {
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  className,
  placeholder,
  ariaLabel,
  disabled,
  onClick,
}: NumberInputProps) {
  const [draft, setDraft] = useState<string>(value === undefined ? "" : String(value));

  useEffect(() => {
    // Reconcile only when the parent's value differs from what the draft
    // would produce. Avoids stomping on a freshly-typed draft that's about
    // to commit (e.g. user typed "12", parent receives 12, this runs).
    const parsed = draft === "" ? undefined : Number(draft);
    if (parsed !== value && !(Number.isNaN(parsed) && value === undefined)) {
      setDraft(value === undefined ? "" : String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="number"
      value={draft}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        if (raw === "") {
          onChange(undefined);
          return;
        }
        const n = Number(raw);
        if (Number.isFinite(n)) onChange(n);
      }}
      min={min}
      max={max}
      step={step}
      className={className}
      placeholder={placeholder}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
    />
  );
}
