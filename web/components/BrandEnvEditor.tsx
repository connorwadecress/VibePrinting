"use client";

import { useState } from "react";
import {
  BRAND_ENV_GROUPS,
  type BrandEnvKey,
  type BrandEnvMap,
} from "@/lib/brand-env-types";

interface Props {
  brandId: string;
  initial: BrandEnvMap;
}

const KEY_LABELS: Record<BrandEnvKey, string> = {
  LLM_PROVIDER: "Provider",
  ANTHROPIC_API_KEY: "Anthropic API Key",
  CLAUDE_MODEL: "Claude Model ID",
  GEMINI_API_KEY: "Gemini API Key",
  GEMINI_MODEL: "Gemini Model ID",
  TTS_PROVIDER: "TTS Provider",
  TTS_VOICE: "Voice",
  TTS_RATE: "Rate",
  ELEVENLABS_API_KEY: "ElevenLabs API Key",
  ELEVENLABS_VOICE_ID: "Voice ID",
  ELEVENLABS_MODEL_ID: "Model ID",
  PEXELS_API_KEY: "Pexels API Key",
  YOUTUBE_CLIENT_ID: "Client ID",
  YOUTUBE_CLIENT_SECRET: "Client Secret",
  YOUTUBE_REFRESH_TOKEN: "Refresh Token",
  YOUTUBE_CHANNEL_ID: "Channel ID",
  TIKTOK_CLIENT_KEY: "Client Key",
  TIKTOK_CLIENT_SECRET: "Client Secret",
  TIKTOK_ACCESS_TOKEN: "Access Token",
  TIKTOK_REFRESH_TOKEN: "Refresh Token",
};

const KEY_PLACEHOLDERS: Partial<Record<BrandEnvKey, string>> = {
  LLM_PROVIDER: "claude  or  gemini",
  CLAUDE_MODEL: "claude-haiku-4-5-20251001",
  GEMINI_MODEL: "gemini-2.0-flash",
  TTS_PROVIDER: "edge  or  elevenlabs",
  TTS_VOICE: "en-US-GuyNeural",
  TTS_RATE: "+10%",
};

const SENSITIVE: Set<BrandEnvKey> = new Set([
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "ELEVENLABS_API_KEY",
  "PEXELS_API_KEY",
  "YOUTUBE_CLIENT_SECRET",
  "YOUTUBE_REFRESH_TOKEN",
  "TIKTOK_CLIENT_SECRET",
  "TIKTOK_ACCESS_TOKEN",
  "TIKTOK_REFRESH_TOKEN",
]);

export function BrandEnvEditor({ brandId, initial }: Props) {
  const [values, setValues] = useState<BrandEnvMap>({ ...initial });
  const [revealed, setRevealed] = useState<Set<BrandEnvKey>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleReveal(key: BrandEnvKey) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function onChange(key: BrandEnvKey, val: string) {
    setSaved(false);
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/brands/${brandId}/env`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setValues(data.env as BrandEnvMap);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message ?? "Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-8">
      {BRAND_ENV_GROUPS.map((group) => (
        <div key={group.label}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-fg-muted">
            {group.label}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.keys.map((key) => {
              const isSecret = SENSITIVE.has(key);
              const show = !isSecret || revealed.has(key);
              return (
                <label key={key} className="block">
                  <span className="label">{KEY_LABELS[key]}</span>
                  <div className="relative mt-1.5 flex items-center gap-1">
                    <input
                      type={show ? "text" : "password"}
                      value={values[key]}
                      onChange={(e) => onChange(key, e.target.value)}
                      placeholder={KEY_PLACEHOLDERS[key] ?? (isSecret ? "not set" : "")}
                      className="input input-sm flex-1 font-mono text-xs"
                      autoComplete="off"
                    />
                    {isSecret && (
                      <button
                        type="button"
                        onClick={() => toggleReveal(key)}
                        className="btn-ghost btn-sm px-2 text-xs text-fg-muted"
                        title={show ? "Hide" : "Show"}
                      >
                        {show ? "hide" : "show"}
                      </button>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      {error && <p className="alert-error">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary btn-sm">
          {saving ? "Saving…" : "Save configuration"}
        </button>
        {saved && <span className="text-xs text-success">Saved.</span>}
      </div>
    </form>
  );
}
