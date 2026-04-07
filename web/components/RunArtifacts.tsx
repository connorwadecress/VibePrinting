"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RunFilesPayload } from "@/lib/run-files-types";

/**
 * Run artifacts panel — shown on /runs/[jobId] under the metadata
 * card. Polls /api/runs/[jobId]/files for the on-disk state of the
 * run directory and renders:
 *
 *   - Preview <video> (when final.mp4 still on disk)
 *   - Expiry countdown (when a deletion is queued)
 *   - "Upload to YouTube/TikTok" buttons that flip to
 *     "Uploaded to <platform>" links once a successful upload-log
 *     entry exists for the run
 *   - "Expired" message when the run dir has been swept
 *
 * Buttons that target a platform with no credentials configured will
 * still attempt the spawn — the retry script returns the credential
 * error message which we surface in a toast row.
 */

interface Props {
  jobId: string;
  initial: RunFilesPayload;
}

const PLATFORMS = [
  { id: "youtube", label: "YouTube" },
  { id: "tiktok", label: "TikTok" },
] as const;

export function RunArtifacts({ jobId, initial }: Props) {
  const [data, setData] = useState<RunFilesPayload>(initial);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/runs/${encodeURIComponent(jobId)}/files`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const next = (await res.json()) as RunFilesPayload;
      setData(next);
    } catch {}
  }, [jobId]);

  // Poll while a manual upload is in flight or while the run dir is
  // about to expire — otherwise back off to a slow heartbeat.
  useEffect(() => {
    const anyInFlight = data.inFlight.youtube || data.inFlight.tiktok;
    const tick = anyInFlight ? 2000 : 15_000;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(fetchStatus, tick);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [data.inFlight.youtube, data.inFlight.tiktok, fetchStatus]);

  async function triggerUpload(platform: "youtube" | "tiktok") {
    setError(null);
    setPending((p) => ({ ...p, [platform]: true }));
    try {
      const res = await fetch(`/api/runs/${encodeURIComponent(jobId)}/upload`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? `HTTP ${res.status}`);
        return;
      }
      // Optimistically reflect in-flight state, then refetch.
      setData((d) => ({ ...d, inFlight: { ...d.inFlight, [platform]: true } }));
      await fetchStatus();
    } finally {
      setPending((p) => ({ ...p, [platform]: false }));
    }
  }

  const { status, inFlight } = data;
  const expired = !status.exists || !status.hasFinalMp4;

  return (
    <div className="card space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="section-title">Artifacts</div>
          <div className="mt-1 text-sm text-fg-muted">
            {expired ? (
              <span className="text-fg-subtle">
                Files no longer on disk — this run has expired and been swept.
              </span>
            ) : (
              <>
                <code className="font-mono text-xs text-fg-muted">final.mp4</code>{" "}
                <span className="text-fg-subtle">
                  · {formatBytes(status.finalMp4Size)}
                </span>
                {status.deleteAfter && (
                  <>
                    {" "}
                    <span className="text-fg-subtle">·</span>{" "}
                    <ExpiryCountdown deleteAfter={status.deleteAfter} />
                  </>
                )}
              </>
            )}
          </div>
        </div>
        {expired ? (
          <span className="pill-muted">expired</span>
        ) : (
          <span className="pill-success">on disk</span>
        )}
      </div>

      {!expired && (
        <div className="overflow-hidden rounded-xl border border-border bg-black/40">
          <video
            key={jobId}
            controls
            preload="metadata"
            className="block max-h-[60vh] w-full bg-black"
            src={`/api/runs/${encodeURIComponent(jobId)}/video`}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {PLATFORMS.map((p) => {
          const last = status.lastUploads.find((u) => u.platform === p.id);
          const uploaded = status.uploadedPlatforms.includes(p.id);
          const flight = inFlight[p.id] || pending[p.id];

          if (uploaded && last?.entry.url) {
            return (
              <a
                key={p.id}
                href={last.entry.url}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary btn-sm text-success hover:text-success"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 8l3.5 3.5L13 5" />
                </svg>
                Uploaded to {p.label}
                <span aria-hidden className="text-fg-subtle">↗</span>
              </a>
            );
          }

          const disabled = expired || flight;
          const label = flight
            ? `Uploading to ${p.label}…`
            : last?.entry.status === "failure"
              ? `Retry ${p.label} upload`
              : `Upload to ${p.label}`;

          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => triggerUpload(p.id as "youtube" | "tiktok")}
              className="btn-primary btn-sm"
            >
              {flight && (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              {label}
            </button>
          );
        })}

        {expired && (
          <span className="text-xs text-fg-subtle">
            Manual uploads are unavailable once the run dir is gone.
          </span>
        )}
      </div>

      {/* Surface failure messages from the most recent attempt(s). */}
      {status.lastUploads
        .filter((u) => u.entry.status === "failure")
        .map((u) => (
          <div key={u.platform} className="alert-error">
            <span className="font-mono text-[11px] uppercase">{u.platform}</span>{" "}
            {u.entry.error ?? "upload failed"}
          </div>
        ))}

      {error && <div className="alert-error">{error}</div>}
    </div>
  );
}

function ExpiryCountdown({ deleteAfter }: { deleteAfter: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const remainingMs = Date.parse(deleteAfter) - now;
  if (remainingMs <= 0) {
    return <span className="text-warning">deletion pending</span>;
  }
  const mins = Math.ceil(remainingMs / 60_000);
  return (
    <span className="text-fg-muted">
      auto-delete in <span className="text-warning">{formatMinutes(mins)}</span>
    </span>
  );
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}
