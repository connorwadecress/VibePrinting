"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChannelProfile } from "@pipeline/domain/channel-profile";

/**
 * Raw channel.json editor — paste a full profile and save. Goes through
 * the same Zod-validated PUT /api/brands/[id] endpoint as the form.
 */
export function BrandJsonEditor({ initial }: { initial: ChannelProfile }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(() => JSON.stringify(initial, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function onSave() {
    setError(null);
    setSavedAt(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      setError(`Invalid JSON: ${(err as Error).message}`);
      return;
    }

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "id" in parsed &&
      (parsed as { id: unknown }).id !== initial.id
    ) {
      setError(
        `Brand id mismatch: payload has "${
          (parsed as { id: unknown }).id
        }" but this page is for "${initial.id}". Edit the id field to match or use the right brand page.`,
      );
      return;
    }

    try {
      const res = await fetch(`/api/brands/${initial.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
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

  function onFormat() {
    try {
      setText(JSON.stringify(JSON.parse(text), null, 2));
      setError(null);
    } catch (err) {
      setError(`Invalid JSON: ${(err as Error).message}`);
    }
  }

  function onReset() {
    setText(JSON.stringify(initial, null, 2));
    setError(null);
    setSavedAt(null);
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setSavedAt(`Copied at ${new Date().toLocaleTimeString()}`);
    } catch {
      setError("Clipboard copy blocked by browser");
    }
  }

  return (
    <div className="space-y-3 pb-24">
      <p className="text-xs text-fg-muted">
        Paste a full <code className="font-mono">channel.json</code>. Validated server-side
        against the same schema as the form. The brand id must match{" "}
        <code className="font-mono">{initial.id}</code>.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        className="input min-h-[60vh] w-full resize-y font-mono text-xs leading-relaxed"
      />

      {error && <div className="alert-error">{error}</div>}
      {savedAt && !error && <div className="alert-success">{savedAt}</div>}

      <div className="sticky bottom-0 -mx-4 border-t border-border bg-bg/85 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onCopy} className="btn-secondary btn-sm">
            Copy
          </button>
          <button type="button" onClick={onFormat} className="btn-secondary btn-sm">
            Format
          </button>
          <button type="button" onClick={onReset} className="btn-secondary btn-sm">
            Reset
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="btn-primary btn-sm"
          >
            {pending ? "Saving…" : "Save JSON"}
          </button>
        </div>
      </div>
    </div>
  );
}
