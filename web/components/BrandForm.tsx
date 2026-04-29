"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AssetEntry, ChannelProfile } from "@pipeline/domain/channel-profile";
import type { ContentLane, LaneType } from "@pipeline/domain/models";
import { TagInput } from "@/components/TagInput";
import { ContentLanesEditor } from "@/components/ContentLanesEditor";
import type { BrandAssetLists } from "@/lib/brand-io";
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
  assets: BrandAssetLists;
}

export function BrandForm({ initial, assets }: BrandFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [profile, setProfile] = useState<ChannelProfile>(initial);

  const isDirty = useMemo(
    () => JSON.stringify(profile) !== JSON.stringify(initial),
    [profile, initial],
  );

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

      <LanesByType
        lanes={profile.contentLanes}
        onChange={(lanes) => update("contentLanes", lanes)}
      />

      <Card title="Asset library">
        <p className="-mt-1 mb-3 text-xs text-fg-subtle">
          Reddit story lanes pick from the cross-brand{" "}
          <a href="/library" className="text-accent hover:underline">
            shared library
          </a>
          . Add or remove files there; toggle which ones <em>this brand</em> is allowed to use below.
        </p>
        <AssetLibraryPanel
          label="Gameplay clips"
          emptyHint="No gameplay clips uploaded yet — add some on the shared library page."
          diskFiles={assets.gameplay}
          entries={profile.gameplayLibrary}
          onChange={(next) => update("gameplayLibrary", next)}
        />
        <AssetLibraryPanel
          label="Music tracks"
          emptyHint="No music tracks uploaded yet — add some on the shared library page."
          diskFiles={assets.music}
          entries={profile.musicLibrary}
          onChange={(next) => update("musicLibrary", next)}
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
        <Field label="Edge rate (% faster than default)">
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="number"
              min={-50}
              max={100}
              step={5}
              value={parseRatePercent(profile.ttsRate)}
              onChange={(e) => update("ttsRate", formatRatePercent(Number(e.target.value)))}
              className="input input-sm w-32"
            />
            <span className="text-xs text-fg-muted">
              0 = default speed. Try 25-40 for snappier delivery.
            </span>
          </div>
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

      <Card title="Compliance">
        <p className="mb-2 text-xs text-fg-muted">
          Whether YouTube uploads should set the synthetic-media disclosure flag.
        </p>
        <Field label="Disclosure required on YouTube">
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
            Mark videos as synthetic / AI-generated
          </label>
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

      {isDirty && (
        <div className="sticky bottom-0 -mx-4 border-t border-border bg-bg/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-fg-muted">Unsaved changes</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setProfile(initial)}
                className="btn-secondary btn-sm"
              >
                Discard
              </button>
              <button type="submit" disabled={pending} className="btn-primary btn-sm">
                {pending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
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

function laneTypeOf(l: ContentLane): LaneType {
  return l.type === "reddit-story" ? "reddit-story" : "pexels-api";
}

interface AssetLibraryPanelProps {
  label: string;
  emptyHint: string;
  diskFiles: string[];
  entries: AssetEntry[] | undefined;
  onChange: (next: AssetEntry[] | undefined) => void;
}

/**
 * Merges the on-disk file list with the channel.json entries[] config
 * into a unified table the operator can edit. Toggling enabled, moving,
 * or removing rows updates the entries[] (which is what gets persisted
 * and read by the LibraryGameplayProvider / LibraryMusicProvider).
 *
 * Files on disk but not in entries[] appear as "new" — toggling or saving
 * promotes them into the persisted list. Entries with no disk match are
 * shown as "missing" so the operator can clean them up.
 */
function AssetLibraryPanel({
  label,
  emptyHint,
  diskFiles,
  entries,
  onChange,
}: AssetLibraryPanelProps) {
  const diskSet = new Set(diskFiles);
  const entryNames = new Set((entries ?? []).map((e) => e.filename));

  // Display order: existing entries in their stored order, then any new
  // disk files appended (they default to enabled when first saved).
  const rows: Array<{
    filename: string;
    enabled: boolean;
    inConfig: boolean;
    onDisk: boolean;
  }> = [];
  for (const e of entries ?? []) {
    rows.push({
      filename: e.filename,
      enabled: e.enabled !== false,
      inConfig: true,
      onDisk: diskSet.has(e.filename),
    });
  }
  for (const f of diskFiles) {
    if (!entryNames.has(f)) {
      rows.push({ filename: f, enabled: true, inConfig: false, onDisk: true });
    }
  }

  function persist(next: Array<{ filename: string; enabled: boolean }>) {
    if (next.length === 0) {
      onChange(undefined);
      return;
    }
    onChange(next.map((r) => ({ filename: r.filename, enabled: r.enabled })));
  }

  function toggle(filename: string, enabled: boolean) {
    const list = rows.map((r) =>
      r.filename === filename ? { filename: r.filename, enabled } : { filename: r.filename, enabled: r.enabled },
    );
    persist(list);
  }

  function move(idx: number, delta: -1 | 1) {
    const next = idx + delta;
    if (next < 0 || next >= rows.length) return;
    const arr = rows.map((r) => ({ filename: r.filename, enabled: r.enabled }));
    const [item] = arr.splice(idx, 1);
    arr.splice(next, 0, item);
    persist(arr);
  }

  function removeOrphan(filename: string) {
    const list = rows
      .filter((r) => r.filename !== filename)
      .map((r) => ({ filename: r.filename, enabled: r.enabled }));
    persist(list);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="text-[10px] uppercase tracking-wider text-fg-subtle">
          {rows.filter((r) => r.enabled && r.onDisk).length} eligible / {rows.length} total
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-surface/40 px-3 py-4 text-center text-xs text-fg-subtle">
          {emptyHint}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border/70 bg-surface-2/40">
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r, idx) => (
                <tr
                  key={r.filename}
                  className={
                    "border-b border-border/40 last:border-b-0 " +
                    (!r.onDisk ? "bg-danger/5" : "")
                  }
                >
                  <td className="w-8 py-1 pl-1 align-middle">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => move(idx, -1)}
                        disabled={idx === 0}
                        className="grid size-4 cursor-pointer place-items-center rounded text-[10px] text-fg-subtle hover:bg-surface-3 hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="Move up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => move(idx, +1)}
                        disabled={idx === rows.length - 1}
                        className="grid size-4 cursor-pointer place-items-center rounded text-[10px] text-fg-subtle hover:bg-surface-3 hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="Move down"
                      >
                        ▼
                      </button>
                    </div>
                  </td>
                  <td className="py-1.5 pl-2 pr-2 align-middle">
                    <label className="flex cursor-pointer items-center gap-2 text-fg-muted">
                      <input
                        type="checkbox"
                        checked={r.enabled && r.onDisk}
                        onChange={(e) => toggle(r.filename, e.target.checked)}
                        disabled={!r.onDisk}
                        className="h-3.5 w-3.5"
                      />
                      <span
                        className={
                          "truncate font-mono text-xs " +
                          (!r.onDisk ? "text-fg-subtle line-through" : "")
                        }
                        title={r.filename}
                      >
                        {r.filename}
                      </span>
                    </label>
                  </td>
                  <td className="py-1.5 pr-2 text-right align-middle">
                    {!r.onDisk ? (
                      <button
                        type="button"
                        onClick={() => removeOrphan(r.filename)}
                        className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-danger hover:bg-danger/10"
                      >
                        Missing — remove
                      </button>
                    ) : !r.inConfig ? (
                      <span className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-accent">
                        New
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LanesByType({
  lanes,
  onChange,
}: {
  lanes: ContentLane[];
  onChange: (next: ContentLane[]) => void;
}) {
  const topic = lanes.filter((l) => laneTypeOf(l) === "pexels-api");
  const reddit = lanes.filter((l) => laneTypeOf(l) === "reddit-story");
  return (
    <>
      <div className="card p-5">
        <div className="mb-1 flex items-baseline justify-between">
          <div className="section-title">Topic-driven lanes ({topic.length})</div>
        </div>
        <p className="mb-4 text-xs text-fg-subtle">
          AI picks a topic from the lane, fetches Pexels stock footage, and narrates it. Best for explainer-style content.
        </p>
        <ContentLanesEditor
          laneType="pexels-api"
          value={topic}
          onChange={(next) => onChange([...next, ...reddit])}
        />
      </div>

      <div className="card p-5">
        <div className="mb-1 flex items-baseline justify-between">
          <div className="section-title">Reddit story lanes ({reddit.length})</div>
        </div>
        <p className="mb-4 text-xs text-fg-subtle">
          Reads a top post + comments from your chosen subreddits over gameplay footage from the asset library.
        </p>
        <ContentLanesEditor
          laneType="reddit-story"
          value={reddit}
          onChange={(next) => onChange([...topic, ...next])}
        />
      </div>
    </>
  );
}

function parseRatePercent(rate: string | undefined): number {
  if (!rate) return 0;
  const m = rate.match(/-?\d+(\.\d+)?/);
  return m ? Math.round(Number(m[0])) : 0;
}

function formatRatePercent(n: number): string {
  const v = Math.round(n);
  return v >= 0 ? `+${v}%` : `${v}%`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div>{children}</div>
    </label>
  );
}
