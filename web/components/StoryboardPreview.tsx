"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Lightbox {
  url: string;
  caption: string;
}

interface StoryboardScene {
  sceneIndex: number;
  title: string;
  narration: string;
  visualIntent: string;
  storyPurpose: string;
  camera: string;
  composition: string;
  motion: string;
  caption: string;
  seconds: number;
  sketchFramePath: string;
  /** Optional Pollinations-generated concept sketch. */
  aiSketchPath?: string;
  assetNeeds: string[];
}

interface StoryboardDeck {
  hook: string;
  payoff: string;
  scenes: StoryboardScene[];
}

type SceneReviewStatus = "pending" | "approved" | "changes_requested";
interface SceneReview {
  sceneIndex: number;
  status: SceneReviewStatus;
  notes: string | null;
  reviewer: string | null;
  updatedAt: string;
}
interface SceneReviewsFile {
  version: 1;
  reviews: Record<string, SceneReview>;
}

/**
 * Horizontal row layout for the storyboard gate.
 *  ┌──────────┬─────────────────────────────────┬───────────────────┐
 *  │  image   │  narration / intent / metadata  │  per-scene review │
 *  └──────────┴─────────────────────────────────┴───────────────────┘
 *
 * Each row owns its own per-scene approval state, persisted to
 * <runDir>/scene-reviews.json via PUT /api/runs/[jobId]/scene-reviews.
 * The gate-level Approve / Request changes / Reject controls remain in
 * <ApprovalPanel/> below the rows.
 */
export function StoryboardPreview({ jobId }: { jobId: string }) {
  const [deck, setDeck] = useState<StoryboardDeck | null>(null);
  const [reviews, setReviews] = useState<Record<string, SceneReview>>({});
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<Lightbox | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch(`/api/runs/${encodeURIComponent(jobId)}/artifact?name=storyboard.json`).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`storyboard ${r.status}`)),
      ),
      fetch(`/api/runs/${encodeURIComponent(jobId)}/scene-reviews`).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`reviews ${r.status}`)),
      ),
    ])
      .then(([d, r]: [StoryboardDeck, SceneReviewsFile]) => {
        if (!alive) return;
        setDeck(d);
        setReviews(r.reviews ?? {});
      })
      .catch((err) => alive && setError((err as Error).message));
    return () => {
      alive = false;
    };
  }, [jobId]);

  // Esc to close the lightbox.
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox]);

  const onReviewSaved = useCallback((review: SceneReview) => {
    setReviews((prev) => ({ ...prev, [String(review.sceneIndex)]: review }));
  }, []);

  if (error) return <p className="alert-error">Could not load storyboard: {error}</p>;
  if (!deck) return <p className="text-xs text-fg-subtle">Loading storyboard…</p>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="card p-3">
          <div className="section-title mb-1">Hook</div>
          <p className="text-fg">{deck.hook}</p>
        </div>
        <div className="card p-3">
          <div className="section-title mb-1">Payoff</div>
          <p className="text-fg">{deck.payoff}</p>
        </div>
      </div>
      <ol className="space-y-3">
        {deck.scenes.map((scene) => (
          <SceneRow
            key={scene.sceneIndex}
            scene={scene}
            jobId={jobId}
            review={reviews[String(scene.sceneIndex)]}
            onSaved={onReviewSaved}
            onZoom={setLightbox}
          />
        ))}
      </ol>
      {lightbox && <LightboxOverlay lightbox={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function LightboxOverlay({ lightbox, onClose }: { lightbox: Lightbox; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Full size: ${lightbox.caption}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-full max-w-7xl flex-col gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={lightbox.url}
          alt={lightbox.caption}
          className="max-h-[85vh] w-auto rounded-xl border border-border bg-[#0e1120] object-contain shadow-2xl"
        />
        <div className="flex items-center justify-between gap-3 text-xs text-fg-muted">
          <span className="truncate">{lightbox.caption}</span>
          <div className="flex items-center gap-2">
            <a
              href={lightbox.url}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost btn-sm"
            >
              Open in tab ↗
            </a>
            <button type="button" onClick={onClose} className="btn-secondary btn-sm">
              Close (Esc)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SceneRow({
  scene,
  jobId,
  review,
  onSaved,
  onZoom,
}: {
  scene: StoryboardScene;
  jobId: string;
  review: SceneReview | undefined;
  onSaved: (r: SceneReview) => void;
  onZoom: (lb: Lightbox) => void;
}) {
  const status: SceneReviewStatus = review?.status ?? "pending";
  const [notes, setNotes] = useState<string>(review?.notes ?? "");
  const [savingStatus, setSavingStatus] = useState<SceneReviewStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedNotesRef = useRef<string>(review?.notes ?? "");
  const isImage =
    scene.sketchFramePath.endsWith(".jpg") || scene.sketchFramePath.endsWith(".png");
  const frameUrl = `/api/runs/${encodeURIComponent(jobId)}/artifact?name=${encodeURIComponent(
    scene.sketchFramePath,
  )}`;
  const captionForZoom = `Scene ${String(scene.sceneIndex).padStart(2, "0")} · ${scene.storyPurpose} — ${scene.visualIntent}`;
  const zoomable = isImage; // Wireframe SVG fallback isn't worth zooming into.

  // Sync local notes when the parent reloads reviews from server.
  useEffect(() => {
    setNotes(review?.notes ?? "");
    lastSavedNotesRef.current = review?.notes ?? "";
  }, [review?.notes]);

  const persist = useCallback(
    async (patch: { status?: SceneReviewStatus; notes?: string | null }) => {
      setError(null);
      try {
        const res = await fetch(`/api/runs/${encodeURIComponent(jobId)}/scene-reviews`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sceneIndex: scene.sceneIndex, ...patch }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        onSaved(body.review);
        if (patch.notes !== undefined) {
          lastSavedNotesRef.current = patch.notes ?? "";
        }
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [jobId, scene.sceneIndex, onSaved],
  );

  const onStatusClick = useCallback(
    async (next: SceneReviewStatus) => {
      const target = status === next ? "pending" : next;
      setSavingStatus(target);
      // Flush any pending notes change too so the click captures latest text.
      const trimmed = notes.trim();
      const notesPatch =
        trimmed !== lastSavedNotesRef.current ? trimmed || null : undefined;
      await persist({ status: target, notes: notesPatch });
      setSavingStatus(null);
    },
    [status, notes, persist],
  );

  const onNotesChange = (value: string) => {
    setNotes(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmed = value.trim();
      if (trimmed === lastSavedNotesRef.current) return;
      void persist({ notes: trimmed || null });
    }, 800);
  };

  return (
    <li className="card-elev flex flex-col gap-3 p-3 sm:flex-row sm:items-stretch">
      {/* Left: stacked previews — Pexels stock (matches final video) on top,
          Pollinations AI concept sketch below for creative reference. */}
      <div className="shrink-0 space-y-2 sm:w-96">
        <ThumbButton
          label="STOCK · matches video"
          tone="info"
          url={frameUrl}
          isImage={isImage}
          missingHint="add PEXELS_API_KEY for real preview"
          onZoom={() => onZoom({ url: frameUrl, caption: `${captionForZoom} · stock` })}
        />
        {scene.aiSketchPath ? (
          <ThumbButton
            label="CONCEPT · AI sketch"
            tone="accent"
            url={`/api/runs/${encodeURIComponent(jobId)}/artifact?name=${encodeURIComponent(
              scene.aiSketchPath,
            )}`}
            isImage={true}
            onZoom={() =>
              onZoom({
                url: `/api/runs/${encodeURIComponent(jobId)}/artifact?name=${encodeURIComponent(
                  scene.aiSketchPath!,
                )}`,
                caption: `${captionForZoom} · concept`,
              })
            }
          />
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-surface/40 px-2 py-3 text-center text-[10px] uppercase tracking-wide text-fg-subtle">
            concept sketch unavailable
          </div>
        )}
        <div className="px-1 text-[10px] uppercase tracking-wide text-fg-subtle">
          <span className="font-semibold">Search:</span>{" "}
          {scene.assetNeeds.slice(0, 4).join(" · ") || "—"}
        </div>
      </div>

      {/* Middle: details */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="font-semibold text-fg">
            {String(scene.sceneIndex).padStart(2, "0")} · {scene.storyPurpose}
          </span>
          <span className="text-fg-subtle">{scene.seconds}s</span>
        </div>
        <p className="text-sm text-fg">{scene.narration}</p>
        <p className="text-xs italic text-fg-muted">▸ {scene.visualIntent}</p>
        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
          <MetaPill k="camera" v={scene.camera} />
          <MetaPill k="motion" v={scene.motion} />
          {scene.caption && scene.caption !== "—" && <MetaPill k="caption" v={scene.caption} />}
        </div>
      </div>

      {/* Right: per-scene review controls */}
      <div className="flex shrink-0 flex-col gap-2 border-t border-border pt-3 sm:w-64 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
        <div className="flex items-center justify-between gap-2">
          <SceneStatusPill status={status} />
          {review?.reviewer && (
            <span className="text-[10px] text-fg-subtle">by {review.reviewer}</span>
          )}
        </div>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Per-scene note or change request…"
          rows={3}
          maxLength={4000}
          className="input input-sm resize-none"
        />
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onStatusClick("approved")}
            className={`btn-sm flex-1 ${
              status === "approved"
                ? "btn-primary"
                : "btn border border-border bg-surface text-fg hover:border-success/40 hover:bg-success/10 hover:text-success"
            }`}
            disabled={savingStatus !== null}
            title="Approve this scene"
          >
            {savingStatus === "approved" ? "…" : "✓ OK"}
          </button>
          <button
            type="button"
            onClick={() => onStatusClick("changes_requested")}
            className={`btn-sm flex-1 ${
              status === "changes_requested"
                ? "btn border border-warning bg-warning/20 text-warning"
                : "btn border border-border bg-surface text-fg hover:border-warning/50 hover:bg-warning/10 hover:text-warning"
            }`}
            disabled={savingStatus !== null}
            title="Mark this scene as needing changes"
          >
            {savingStatus === "changes_requested" ? "…" : "✕ Changes"}
          </button>
        </div>
        {error && <p className="text-[10px] text-danger">{error}</p>}
      </div>
    </li>
  );
}

function SceneStatusPill({ status }: { status: SceneReviewStatus }) {
  switch (status) {
    case "approved":
      return <span className="pill-success">approved</span>;
    case "changes_requested":
      return <span className="pill-warning">changes requested</span>;
    default:
      return <span className="pill-muted">pending</span>;
  }
}

function ThumbButton({
  label,
  tone,
  url,
  isImage,
  missingHint,
  onZoom,
}: {
  label: string;
  tone: "info" | "accent";
  url: string;
  isImage: boolean;
  missingHint?: string;
  onZoom: () => void;
}) {
  const ringHover =
    tone === "accent" ? "hover:ring-accent/60" : "hover:ring-info/60";
  const labelTone =
    tone === "accent" ? "text-accent" : "text-info";
  return (
    <button
      type="button"
      onClick={onZoom}
      disabled={!isImage}
      className={`group relative block w-full overflow-hidden rounded-lg bg-[#0e1120] ring-1 ring-border ${
        isImage ? `cursor-zoom-in transition-shadow ${ringHover}` : "cursor-default"
      }`}
      aria-label={isImage ? `Open ${label} full size` : undefined}
    >
      <div className={`absolute left-1.5 top-1.5 z-10 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${labelTone}`}>
        {label}
      </div>
      <div className="relative aspect-video w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label}
          className={
            isImage
              ? "h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              : "h-full w-full object-contain p-2 opacity-90"
          }
          loading="lazy"
        />
        {!isImage && missingHint && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 py-1.5 text-[10px] uppercase tracking-wide text-warning">
            placeholder · {missingHint}
          </div>
        )}
        {isImage && (
          <div className="pointer-events-none absolute right-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            Click to zoom
          </div>
        )}
      </div>
    </button>
  );
}

function MetaPill({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  const display = v.length > 28 ? `${v.slice(0, 25)}…` : v;
  return (
    <span className="pill-muted" title={v}>
      <span className="font-semibold">{k}</span>
      <span className="text-fg-muted"> {display}</span>
    </span>
  );
}
