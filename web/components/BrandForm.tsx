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
          ? data.issues
              .map(
                (i: { path: (string | number)[]; message: string }) =>
                  `${i.path.join(".")}: ${i.message}`,
              )
              .join("; ")
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
    <form onSubmit={onSave} className="space-y-6 pb-24">
      <Card title="Identity">
        <Field label="Brand id">
          <input
            value={profile.id}
            disabled
            className="input input-sm mt-1.5 cursor-not-allowed font-mono"
          />
        </Field>
        <Field label="Display name">
          <input
            value={profile.displayName}
            onChange={(e) => update("displayName", e.target.value)}
            className="input input-sm mt-1.5"
            required
          />
        </Field>
        <Field label="Thesis">
          <textarea
            rows={3}
            value={profile.thesis}
            onChange={(e) => update("thesis", e.target.value)}
            className="input input-sm mt-1.5"
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
        <p className="mb-3 text-xs text-fg-muted">
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
            className="input input-sm mt-1.5"
          >
            {COMMON_YT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tags">
          <div className="mt-1.5">
            <TagInput
              value={profile.branding.tags}
              onChange={(tags) => update("branding", { ...profile.branding, tags })}
              placeholder="Add a tag…"
            />
          </div>
        </Field>
        <Field label="Hashtags">
          <div className="mt-1.5">
            <TagInput
              value={profile.branding.hashtags}
              onChange={(hashtags) =>
                update("branding", { ...profile.branding, hashtags })
              }
              placeholder="#hashtag"
              validate={(raw) => (raw.startsWith("#") ? raw : `#${raw}`)}
            />
          </div>
        </Field>
      </Card>

      <Card title="Voiceover">
        <Field label="Provider">
          <select
            value={profile.ttsProvider ?? "edge"}
            onChange={(e) =>
              update("ttsProvider", e.target.value as "edge" | "elevenlabs")
            }
            className="input input-sm mt-1.5"
          >
            <option value="edge">Edge TTS (free)</option>
            <option value="elevenlabs">ElevenLabs</option>
          </select>
        </Field>
        <Field label="Edge voice">
          <input
            value={profile.ttsVoice}
            onChange={(e) => update("ttsVoice", e.target.value)}
            className="input input-sm mt-1.5"
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
            className="input input-sm mt-1.5"
          />
        </Field>

        {(profile.ttsProvider ?? "edge") === "elevenlabs" && (
          <div className="rounded-lg border border-border bg-surface-2/60 p-4">
            <p className="mb-3 text-xs font-medium text-fg">ElevenLabs settings</p>
            <div className="space-y-3">
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
                  className="input input-sm mt-1.5"
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
                  className="input input-sm mt-1.5"
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
                  className="input input-sm mt-1.5"
                />
              </Field>
            </div>
            <p className="mt-3 text-xs text-fg-subtle">
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
            className="input input-sm mt-1.5"
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </Field>
        <Field label="Disclosure required">
          <label className="mt-2 inline-flex items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={profile.genSecDefaults.disclosureRequired}
              onChange={(e) =>
                update("genSecDefaults", {
                  ...profile.genSecDefaults,
                  disclosureRequired: e.target.checked,
                })
              }
              className="h-4 w-4 rounded border-border bg-surface"
            />
            Required
          </label>
        </Field>
        <Field label="Safe to auto-publish">
          <label className="mt-2 inline-flex items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={profile.genSecDefaults.safeToAutoPublish}
              onChange={(e) =>
                update("genSecDefaults", {
                  ...profile.genSecDefaults,
                  safeToAutoPublish: e.target.checked,
                })
              }
              className="h-4 w-4 rounded border-border bg-surface"
            />
            Allowed
          </label>
        </Field>
        <Field label="Blocked reasons">
          <div className="mt-1.5">
            <TagInput
              value={profile.genSecDefaults.blockedReasons}
              onChange={(blockedReasons) =>
                update("genSecDefaults", { ...profile.genSecDefaults, blockedReasons })
              }
              placeholder="Add a reason…"
            />
          </div>
        </Field>
      </Card>

      <Card title="Cleanup">
        <Field label="Enabled">
          <label className="mt-2 inline-flex items-center gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={profile.cleanup?.enabled ?? true}
              onChange={(e) =>
                update("cleanup", {
                  enabled: e.target.checked,
                  delayMinutes: profile.cleanup?.delayMinutes ?? 30,
                })
              }
              className="h-4 w-4 rounded border-border bg-surface"
            />
            Auto-delete run dirs after upload
          </label>
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
            className="input input-sm mt-1.5"
          />
        </Field>
      </Card>

      <Card title="Caption style">
        <CaptionStyleEditor
          value={profile.captionStyle as CaptionStyleOverride}
          onChange={(next) => update("captionStyle", next as ChannelProfile["captionStyle"])}
        />
      </Card>

      {error && <div className="alert-error">{error}</div>}
      {savedAt && !error && <div className="alert-success">Saved at {savedAt}</div>}

      <div className="sticky bottom-0 -mx-4 border-t border-border bg-bg/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setProfile(initial)}
            className="btn-secondary btn-sm"
          >
            Reset
          </button>
          <button type="submit" disabled={pending} className="btn-primary btn-sm">
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="section-title mb-4">{title}</div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div>{children}</div>
    </label>
  );
}
