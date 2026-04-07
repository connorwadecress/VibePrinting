"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChannelProfile } from "@pipeline/domain/channel-profile";
import { TagInput } from "@/components/TagInput";
import { ContentLanesEditor } from "@/components/ContentLanesEditor";
import {
  CaptionStyleEditor,
  minimizeCaptionOverride,
  type CaptionStyleOverride,
} from "@/components/CaptionStyleEditor";

/**
 * Full ChannelProfile editor — replaces the read-only viewer once
 * the operator clicks "Edit" on the brand page. Save serializes the
 * profile, calls PUT /api/brands/[brandId], and reloads the page.
 *
 * Form state lives in React; on save we minimize the captionStyle
 * override before sending so channel.json stays clean.
 */

const COMMON_YT_CATEGORIES: Array<{ id: string; label: string }> = [
  { id: "1", label: "1 — Film & Animation" },
  { id: "2", label: "2 — Autos & Vehicles" },
  { id: "10", label: "10 — Music" },
  { id: "15", label: "15 — Pets & Animals" },
  { id: "17", label: "17 — Sports" },
  { id: "19", label: "19 — Travel & Events" },
  { id: "20", label: "20 — Gaming" },
  { id: "22", label: "22 — People & Blogs" },
  { id: "23", label: "23 — Comedy" },
  { id: "24", label: "24 — Entertainment" },
  { id: "25", label: "25 — News & Politics" },
  { id: "26", label: "26 — Howto & Style" },
  { id: "27", label: "27 — Education" },
  { id: "28", label: "28 — Science & Technology" },
  { id: "29", label: "29 — Nonprofits & Activism" },
];

export interface BrandFormProps {
  initial: ChannelProfile;
}

export function BrandForm({ initial }: BrandFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [profile, setProfile] = useState<ChannelProfile>(initial);

  function update<K extends keyof ChannelProfile>(key: K, val: ChannelProfile[K]) {
    setProfile((p) => ({ ...p, [key]: val }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedAt(null);

    // Minimize the caption override before sending.
    const minimized = minimizeCaptionOverride(profile.captionStyle as CaptionStyleOverride);
    const payload: ChannelProfile = { ...profile, captionStyle: minimized };

    try {
      const res = await fetch(`/api/brands/${profile.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.issues
          ? data.issues.map((i: { path: (string | number)[]; message: string }) => `${i.path.join(".")}: ${i.message}`).join("; ")
          : data.error ?? `Save failed (${res.status})`;
        setError(msg);
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
      startTransition(() => router.refresh());
    } catch (err) {
      setError((err as Error).message ?? "Network error");
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-6">
      {/* Header — id readonly, displayName editable */}
      <Card title="Identity">
        <Field label="Brand id">
          <input
            value={profile.id}
            disabled
            className="block w-full cursor-not-allowed rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 font-mono text-xs text-neutral-500"
          />
        </Field>
        <Field label="Display name">
          <input
            value={profile.displayName}
            onChange={(e) => update("displayName", e.target.value)}
            className={inputCls}
            required
          />
        </Field>
        <Field label="Thesis">
          <textarea
            rows={3}
            value={profile.thesis}
            onChange={(e) => update("thesis", e.target.value)}
            className={inputCls}
            required
          />
        </Field>
      </Card>

      <Card title={`Content lanes (${profile.contentLanes.length})`}>
        <ContentLanesEditor
          value={profile.contentLanes}
          onChange={(lanes) => update("contentLanes", lanes)}
        />
      </Card>

      <Card title="Publish slots">
        <p className="mb-2 text-xs text-neutral-500">
          Informational only. Use the Schedule page to actually fire runs.
        </p>
        <TagInput
          value={profile.publishSlots}
          onChange={(slots) => update("publishSlots", slots)}
          placeholder="HH:MM"
          validate={(raw) => (/^\d{1,2}:\d{2}$/.test(raw) ? raw : null)}
        />
      </Card>

      <Card title="Branding">
        <Field label="YouTube category">
          <select
            value={profile.branding.youTubeCategory}
            onChange={(e) =>
              update("branding", { ...profile.branding, youTubeCategory: e.target.value })
            }
            className={inputCls}
          >
            {COMMON_YT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tags">
          <TagInput
            value={profile.branding.tags}
            onChange={(tags) => update("branding", { ...profile.branding, tags })}
            placeholder="Add a tag…"
          />
        </Field>
        <Field label="Hashtags">
          <TagInput
            value={profile.branding.hashtags}
            onChange={(hashtags) => update("branding", { ...profile.branding, hashtags })}
            placeholder="#hashtag"
            validate={(raw) => (raw.startsWith("#") ? raw : `#${raw}`)}
          />
        </Field>
      </Card>

      <Card title="Voiceover">
        <Field label="Provider">
          <select
            value={profile.ttsProvider ?? "edge"}
            onChange={(e) => update("ttsProvider", e.target.value as "edge" | "elevenlabs")}
            className={inputCls}
          >
            <option value="edge">Edge TTS (free)</option>
            <option value="elevenlabs">ElevenLabs</option>
          </select>
        </Field>
        <Field label="Edge voice">
          <input
            value={profile.ttsVoice}
            onChange={(e) => update("ttsVoice", e.target.value)}
            className={inputCls}
            list="edge-voices"
          />
          <datalist id="edge-voices">
            <option value="en-US-GuyNeural" />
            <option value="en-US-AriaNeural" />
            <option value="en-US-JennyNeural" />
            <option value="en-US-ChristopherNeural" />
            <option value="en-GB-RyanNeural" />
            <option value="en-GB-SoniaNeural" />
            <option value="en-AU-WilliamNeural" />
          </datalist>
        </Field>
        <Field label="Edge rate">
          <input
            value={profile.ttsRate}
            onChange={(e) => update("ttsRate", e.target.value)}
            placeholder="+10%"
            className={inputCls}
          />
        </Field>

        {(profile.ttsProvider ?? "edge") === "elevenlabs" && (
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
            <p className="mb-2 text-xs font-medium text-neutral-700">ElevenLabs settings</p>
            <Field label="Voice ID">
              <input
                value={profile.ttsProviderSettings?.elevenLabs?.voiceId ?? ""}
                onChange={(e) =>
                  update("ttsProviderSettings", {
                    ...profile.ttsProviderSettings,
                    elevenLabs: {
                      ...profile.ttsProviderSettings?.elevenLabs,
                      voiceId: e.target.value,
                    },
                  })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Model ID">
              <input
                value={profile.ttsProviderSettings?.elevenLabs?.modelId ?? ""}
                onChange={(e) =>
                  update("ttsProviderSettings", {
                    ...profile.ttsProviderSettings,
                    elevenLabs: {
                      ...profile.ttsProviderSettings?.elevenLabs,
                      modelId: e.target.value,
                    },
                  })
                }
                className={inputCls}
              />
            </Field>
            <Field label="Speed">
              <input
                type="number"
                step={0.05}
                min={0.5}
                max={2}
                value={profile.ttsProviderSettings?.elevenLabs?.speed ?? 1}
                onChange={(e) =>
                  update("ttsProviderSettings", {
                    ...profile.ttsProviderSettings,
                    elevenLabs: {
                      ...profile.ttsProviderSettings?.elevenLabs,
                      speed: Number(e.target.value),
                    },
                  })
                }
                className={inputCls}
              />
            </Field>
            <p className="mt-2 text-xs text-neutral-500">
              ELEVENLABS_API_KEY lives in <code className="font-mono">.env</code>, never in this form.
            </p>
          </div>
        )}
      </Card>

      <Card title="GenSec defaults">
        <Field label="Risk level">
          <select
            value={profile.genSecDefaults.riskLevel}
            onChange={(e) =>
              update("genSecDefaults", {
                ...profile.genSecDefaults,
                riskLevel: e.target.value as "low" | "medium" | "high",
              })
            }
            className={inputCls}
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </Field>
        <Field label="Disclosure required">
          <input
            type="checkbox"
            checked={profile.genSecDefaults.disclosureRequired}
            onChange={(e) =>
              update("genSecDefaults", {
                ...profile.genSecDefaults,
                disclosureRequired: e.target.checked,
              })
            }
          />
        </Field>
        <Field label="Safe to auto-publish">
          <input
            type="checkbox"
            checked={profile.genSecDefaults.safeToAutoPublish}
            onChange={(e) =>
              update("genSecDefaults", {
                ...profile.genSecDefaults,
                safeToAutoPublish: e.target.checked,
              })
            }
          />
        </Field>
        <Field label="Blocked reasons">
          <TagInput
            value={profile.genSecDefaults.blockedReasons}
            onChange={(blockedReasons) =>
              update("genSecDefaults", { ...profile.genSecDefaults, blockedReasons })
            }
            placeholder="Add a reason…"
          />
        </Field>
      </Card>

      <Card title="Cleanup">
        <Field label="Enabled">
          <input
            type="checkbox"
            checked={profile.cleanup?.enabled ?? true}
            onChange={(e) =>
              update("cleanup", {
                enabled: e.target.checked,
                delayMinutes: profile.cleanup?.delayMinutes ?? 30,
              })
            }
          />
        </Field>
        <Field label="Delete after (minutes)">
          <input
            type="number"
            min={0}
            max={1440}
            value={profile.cleanup?.delayMinutes ?? 30}
            onChange={(e) =>
              update("cleanup", {
                enabled: profile.cleanup?.enabled ?? true,
                delayMinutes: Number(e.target.value) || 0,
              })
            }
            className={inputCls}
          />
        </Field>
      </Card>

      <Card title="Caption style">
        <CaptionStyleEditor
          value={profile.captionStyle as CaptionStyleOverride}
          onChange={(next) =>
            update("captionStyle", next as ChannelProfile["captionStyle"])
          }
        />
      </Card>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      {savedAt && !error && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          Saved at {savedAt}
        </div>
      )}

      <div className="sticky bottom-0 -mx-8 border-t border-neutral-200 bg-white/95 px-8 py-3 backdrop-blur">
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setProfile(initial)}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-neutral-400"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}

const inputCls =
  "mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-neutral-700">{label}</span>
      <div>{children}</div>
    </label>
  );
}
