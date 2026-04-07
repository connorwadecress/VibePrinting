"use client";

import { useState } from "react";
import {
  DEFAULT_CAPTION_CONFIG,
  type AnimatedCaptionConfig,
} from "@pipeline/remotion/styles";

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
      <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs">
        <span className="text-neutral-600">Caption style: using defaults</span>
        <button
          type="button"
          onClick={startOverride}
          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:border-indigo-300 hover:text-indigo-700"
        >
          Override defaults
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3 text-xs">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-medium text-neutral-700">
          Caption style {overrideExists ? "(custom)" : "(using defaults)"}
        </span>
        <button
          type="button"
          onClick={clearOverride}
          className="text-xs text-neutral-500 hover:text-red-600"
        >
          Reset to defaults
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Font family">
          <input
            value={merged.fontFamily}
            onChange={(e) => update("fontFamily", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Font weight">
          <select
            value={merged.fontWeight}
            onChange={(e) => update("fontWeight", Number(e.target.value))}
            className={inputCls}
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
            className={inputCls}
          />
        </Field>
        <Field label="Words / page">
          <input
            type="number"
            min={1}
            max={12}
            value={merged.wordsPerPage}
            onChange={(e) => update("wordsPerPage", Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        <Field label="Base color">
          <input
            type="color"
            value={merged.baseColor}
            onChange={(e) => update("baseColor", e.target.value)}
            className={inputCls + " p-0 h-7"}
          />
        </Field>
        <Field label="Highlight color">
          <input
            type="color"
            value={merged.highlightColor}
            onChange={(e) => update("highlightColor", e.target.value)}
            className={inputCls + " p-0 h-7"}
          />
        </Field>
        <Field label="Stroke width">
          <input
            type="number"
            min={0}
            max={20}
            value={merged.strokeWidth}
            onChange={(e) => update("strokeWidth", Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        <Field label="Stroke color">
          <input
            type="color"
            value={merged.strokeColor}
            onChange={(e) => update("strokeColor", e.target.value)}
            className={inputCls + " p-0 h-7"}
          />
        </Field>
        <Field label="Y position (%)">
          <input
            type="range"
            min={0}
            max={100}
            value={merged.yPositionPercent}
            onChange={(e) => update("yPositionPercent", Number(e.target.value))}
          />
          <span className="ml-2 font-mono text-neutral-500">{merged.yPositionPercent}%</span>
        </Field>
        <Field label="Animation frames">
          <input
            type="number"
            min={1}
            max={60}
            value={merged.animationDurationFrames}
            onChange={(e) => update("animationDurationFrames", Number(e.target.value))}
            className={inputCls}
          />
        </Field>
        <Field label="Drop shadow">
          <input
            value={merged.dropShadow}
            onChange={(e) => update("dropShadow", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Highlight box">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={merged.highlightBox}
              onChange={(e) => update("highlightBox", e.target.checked)}
            />
            <span className="text-neutral-700">Enabled</span>
          </label>
        </Field>
        {merged.highlightBox && (
          <>
            <Field label="Box color">
              <input
                value={merged.highlightBoxColor}
                onChange={(e) => update("highlightBoxColor", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Box padding">
              <input
                type="number"
                min={0}
                max={40}
                value={merged.highlightBoxPadding}
                onChange={(e) => update("highlightBoxPadding", Number(e.target.value))}
                className={inputCls}
              />
            </Field>
          </>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-neutral-700">{label}</span>
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
