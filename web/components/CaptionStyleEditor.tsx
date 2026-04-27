"use client";

import { useState } from "react";
import {
  DEFAULT_CAPTION_CONFIG,
  type AnimatedCaptionConfig,
} from "@pipeline/remotion/styles";

const SUPPORTED_FONTS = [
  "Montserrat",
  "Inter",
  "Poppins",
  "Oswald",
  "Roboto",
  "Anton",
  "Bebas Neue",
];

/**
 * Collapsible caption style override panel.
 *
 * - When the brand has no captionStyle, the panel is collapsed and
 *   "Override defaults" seeds with DEFAULT_CAPTION_CONFIG.
 * - When the brand has an override, the panel is expanded and shows
 *   merged values (override + defaults for missing fields). "Reset"
 *   removes the override entirely.
 * - On save, the BrandForm calls minimizeOverride() to strip values
 *   equal to defaults so channel.json stays minimal.
 */
export type CaptionStyleOverride = Partial<AnimatedCaptionConfig> | undefined;

export interface CaptionStyleEditorProps {
  value: CaptionStyleOverride;
  onChange: (next: CaptionStyleOverride) => void;
}

export function CaptionStyleEditor({ value, onChange }: CaptionStyleEditorProps) {
  const overrideExists = value !== undefined;
  const [open, setOpen] = useState(overrideExists);

  const merged: AnimatedCaptionConfig = { ...DEFAULT_CAPTION_CONFIG, ...(value ?? {}) };

  function update<K extends keyof AnimatedCaptionConfig>(key: K, val: AnimatedCaptionConfig[K]) {
    onChange({ ...(value ?? {}), [key]: val });
  }

  function startOverride() {
    onChange({ ...DEFAULT_CAPTION_CONFIG });
    setOpen(true);
  }

  function clearOverride() {
    onChange(undefined);
  }

  if (!overrideExists && !open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-2/60 px-4 py-3 text-xs">
        <span className="text-fg-muted">Caption style: using defaults</span>
        <button type="button" onClick={startOverride} className="btn-secondary btn-sm">
          Override defaults
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface-2/60 p-4 text-xs">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-medium text-fg">
          Caption style {overrideExists ? "(custom)" : "(using defaults)"}
        </span>
        <button
          type="button"
          onClick={clearOverride}
          className="text-xs text-fg-subtle hover:text-danger"
        >
          Reset to defaults
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Font family">
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SUPPORTED_FONTS.map((f) => {
              const selected =
                (SUPPORTED_FONTS.includes(merged.fontFamily) ? merged.fontFamily : "Montserrat") === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => update("fontFamily", f)}
                  className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition ${
                    selected
                      ? "border-accent bg-accent/10"
                      : "border-border bg-surface hover:border-fg-subtle"
                  }`}
                >
                  <span
                    className="text-lg leading-tight"
                    style={{ fontFamily: `'${f}', sans-serif`, fontWeight: 700 }}
                  >
                    {f}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-fg-subtle">
                    Aa Bb 123
                  </span>
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Font weight">
          <select
            value={merged.fontWeight}
            onChange={(e) => update("fontWeight", Number(e.target.value))}
            className="input input-sm mt-1.5"
          >
            {[400, 500, 600, 700, 800, 900].map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Font size">
          <input
            type="number"
            min={20}
            max={200}
            value={merged.fontSize}
            onChange={(e) => update("fontSize", Number(e.target.value))}
            className="input input-sm mt-1.5"
          />
        </Field>
        <Field label="Words / page">
          <input
            type="number"
            min={1}
            max={12}
            value={merged.wordsPerPage}
            onChange={(e) => update("wordsPerPage", Number(e.target.value))}
            className="input input-sm mt-1.5"
          />
        </Field>
        <Field label="Base color">
          <input
            type="color"
            value={merged.baseColor}
            onChange={(e) => update("baseColor", e.target.value)}
            className="mt-1.5 h-9 w-full cursor-pointer rounded-lg border border-border bg-surface p-0.5"
          />
        </Field>
        <Field label="Highlight color">
          <input
            type="color"
            value={merged.highlightColor}
            onChange={(e) => update("highlightColor", e.target.value)}
            className="mt-1.5 h-9 w-full cursor-pointer rounded-lg border border-border bg-surface p-0.5"
          />
        </Field>
        <Field label="Stroke width">
          <input
            type="number"
            min={0}
            max={20}
            value={merged.strokeWidth}
            onChange={(e) => update("strokeWidth", Number(e.target.value))}
            className="input input-sm mt-1.5"
          />
        </Field>
        <Field label="Stroke color">
          <input
            type="color"
            value={merged.strokeColor}
            onChange={(e) => update("strokeColor", e.target.value)}
            className="mt-1.5 h-9 w-full cursor-pointer rounded-lg border border-border bg-surface p-0.5"
          />
        </Field>
        <Field label="Y position (%)">
          <div className="mt-1.5 flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={merged.yPositionPercent}
              onChange={(e) => update("yPositionPercent", Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-10 text-right font-mono text-xs text-fg-muted">
              {merged.yPositionPercent}%
            </span>
          </div>
        </Field>
        <Field label="Animation frames">
          <input
            type="number"
            min={1}
            max={60}
            value={merged.animationDurationFrames}
            onChange={(e) => update("animationDurationFrames", Number(e.target.value))}
            className="input input-sm mt-1.5"
          />
        </Field>
        <Field label="Drop shadow">
          <input
            value={merged.dropShadow}
            onChange={(e) => update("dropShadow", e.target.value)}
            className="input input-sm mt-1.5"
          />
        </Field>
        <Field label="Highlight box">
          <label className="mt-2 inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={merged.highlightBox}
              onChange={(e) => update("highlightBox", e.target.checked)}
              className="h-4 w-4 rounded border-border bg-surface"
            />
            <span className="text-fg-muted">Enabled</span>
          </label>
        </Field>
        {merged.highlightBox && (
          <>
            <Field label="Box color">
              <input
                value={merged.highlightBoxColor}
                onChange={(e) => update("highlightBoxColor", e.target.value)}
                className="input input-sm mt-1.5"
              />
            </Field>
            <Field label="Box padding">
              <input
                type="number"
                min={0}
                max={40}
                value={merged.highlightBoxPadding}
                onChange={(e) => update("highlightBoxPadding", Number(e.target.value))}
                className="input input-sm mt-1.5"
              />
            </Field>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

/**
 * Strip values equal to defaults so the persisted override stays
 * minimal. Returns undefined if no field differs from the default.
 */
export function minimizeCaptionOverride(
  override: CaptionStyleOverride,
): CaptionStyleOverride {
  if (!override) return undefined;
  const out: Partial<AnimatedCaptionConfig> = {};
  for (const k of Object.keys(override) as (keyof AnimatedCaptionConfig)[]) {
    const v = override[k];
    if (v === undefined) continue;
    if (v !== DEFAULT_CAPTION_CONFIG[k]) {
      // @ts-expect-error indexed assignment
      out[k] = v;
    }
  }
  return Object.keys(out).length ? out : undefined;
}
