"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Client-side editor for one slice of the shared asset library
 * (gameplay or music). Does:
 *   - drag-and-drop / click upload (multiple files, sequential POSTs)
 *   - per-row delete with confirmation
 *   - inline progress + error reporting
 *
 * Backed by /api/library/[kind] (GET/POST) and /api/library/[kind]/[filename] (DELETE).
 * Server component renders the initial list; we keep a local mirror so
 * the UI stays responsive during uploads. router.refresh() re-pulls the
 * authoritative list when an upload settles.
 */

export type LibraryKind = "gameplay" | "music";

export interface SharedLibraryEntry {
  filename: string;
  sizeBytes: number;
  modifiedMs: number;
}

interface Props {
  kind: LibraryKind;
  title: string;
  description: string;
  initial: SharedLibraryEntry[];
}

interface UploadState {
  filename: string;
  status: "uploading" | "success" | "error";
  error?: string;
}

const ACCEPT_BY_KIND: Record<LibraryKind, string> = {
  gameplay: ".mp4,.mov,.mkv,.webm",
  music: ".mp3,.m4a,.wav,.aac,.ogg",
};

export function SharedLibraryEditor({ kind, title, description, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [entries, setEntries] = useState<SharedLibraryEntry[]>(initial);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalBytes = useMemo(
    () => entries.reduce((sum, e) => sum + e.sizeBytes, 0),
    [entries],
  );

  async function uploadOne(file: File): Promise<void> {
    const filename = file.name;
    setUploads((prev) => [...prev, { filename, status: "uploading" }]);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/library/${kind}`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.error ?? `Upload failed (${res.status})`;
        setUploads((prev) =>
          prev.map((u) =>
            u.filename === filename && u.status === "uploading"
              ? { ...u, status: "error", error: msg }
              : u,
          ),
        );
        return;
      }
      setUploads((prev) =>
        prev.map((u) =>
          u.filename === filename && u.status === "uploading"
            ? { ...u, status: "success" }
            : u,
        ),
      );
    } catch (err) {
      setUploads((prev) =>
        prev.map((u) =>
          u.filename === filename && u.status === "uploading"
            ? { ...u, status: "error", error: (err as Error).message ?? "Network error" }
            : u,
        ),
      );
    }
  }

  async function handleFiles(files: FileList | File[]) {
    setGlobalError(null);
    const list = Array.from(files);
    if (list.length === 0) return;
    // Upload sequentially so the UI doesn't try to push 10 video files
    // through the network at once — and so the server picks one File at a time.
    for (const f of list) {
      await uploadOne(f);
    }
    // Authoritative refresh so server-side listing replaces our optimistic mirror.
    startTransition(() => router.refresh());
    // After router.refresh re-renders the parent server component, the
    // `initial` prop changes — but we don't get that here unless we mount-key.
    // Instead, refetch the list ourselves so the deletion buttons stay in sync.
    try {
      const res = await fetch(`/api/library/${kind}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { entries: SharedLibraryEntry[] };
        setEntries(data.entries);
      }
    } catch {
      /* non-fatal — server-rendered list is the source of truth on next nav */
    }
  }

  async function handleDelete(filename: string) {
    if (!confirm(`Delete "${filename}" from the shared ${kind} library?`)) return;
    setGlobalError(null);
    try {
      const res = await fetch(
        `/api/library/${kind}/${encodeURIComponent(filename)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setGlobalError(body.error ?? `Delete failed (${res.status})`);
        return;
      }
      setEntries((prev) => prev.filter((e) => e.filename !== filename));
      startTransition(() => router.refresh());
    } catch (err) {
      setGlobalError((err as Error).message ?? "Network error");
    }
  }

  function clearFinishedUploads() {
    setUploads((prev) => prev.filter((u) => u.status === "uploading"));
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="section-title">{title}</div>
          <p className="mt-1 max-w-2xl text-xs text-fg-subtle">{description}</p>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-fg-subtle">
          {entries.length} file{entries.length === 1 ? "" : "s"} · {formatBytes(totalBytes)}
        </div>
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
        }}
        className={
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors " +
          (dragOver
            ? "border-accent bg-accent/10 text-fg"
            : "border-border bg-surface/40 text-fg-muted hover:border-accent/60 hover:bg-surface-2/40")
        }
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_BY_KIND[kind]}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            // Reset so re-uploading the same filename re-fires onChange.
            e.target.value = "";
          }}
        />
        <p className="text-sm font-medium">
          Drop files here or click to browse
        </p>
        <p className="mt-1 text-[11px] text-fg-subtle">
          Allowed: {ACCEPT_BY_KIND[kind].replaceAll(",", ", ")} · max 500MB per file
        </p>
      </label>

      {uploads.length > 0 && (
        <div className="mt-3 space-y-1.5 rounded-md border border-border/70 bg-surface-2/40 p-3 text-xs">
          <div className="flex items-baseline justify-between">
            <span className="text-fg-muted">Recent uploads</span>
            <button
              type="button"
              onClick={clearFinishedUploads}
              className="text-[10px] uppercase tracking-wider text-fg-subtle hover:text-fg"
            >
              Clear finished
            </button>
          </div>
          <ul className="space-y-1">
            {uploads.map((u, i) => (
              <li key={`${u.filename}-${i}`} className="flex items-center justify-between gap-2">
                <span
                  className={
                    "truncate font-mono " +
                    (u.status === "error" ? "text-danger" : "text-fg-muted")
                  }
                  title={u.filename}
                >
                  {u.filename}
                </span>
                <span
                  className={
                    "shrink-0 text-[10px] uppercase tracking-wider " +
                    (u.status === "uploading"
                      ? "text-fg-subtle"
                      : u.status === "success"
                        ? "text-success"
                        : "text-danger")
                  }
                >
                  {u.status === "uploading"
                    ? "Uploading…"
                    : u.status === "success"
                      ? "Done"
                      : (u.error ?? "Failed")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {globalError && <div className="mt-3 alert-error">{globalError}</div>}

      <div className="mt-4">
        {entries.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-surface/40 px-3 py-4 text-center text-xs text-fg-subtle">
            No files yet. Drop some in above and they&rsquo;ll be available to every brand.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-border/70 bg-surface-2/40">
            <table className="w-full text-sm">
              <tbody>
                {entries.map((e) => (
                  <tr
                    key={e.filename}
                    className="border-b border-border/40 last:border-b-0"
                  >
                    <td className="py-1.5 pl-3 pr-2 align-middle">
                      <span
                        className="truncate font-mono text-xs text-fg-muted"
                        title={e.filename}
                      >
                        {e.filename}
                      </span>
                    </td>
                    <td className="w-24 py-1.5 pr-2 text-right align-middle text-[11px] text-fg-subtle">
                      {formatBytes(e.sizeBytes)}
                    </td>
                    <td className="w-24 py-1.5 pr-3 text-right align-middle">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleDelete(e.filename)}
                        className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
