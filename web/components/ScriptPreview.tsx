"use client";

import { useEffect, useState } from "react";

interface Beat {
  narration: string;
  visualIntent: string;
}

interface Claim {
  claim: string;
  confidence: string;
  sourceLabels: string[];
}

interface ScriptArtifact {
  topic?: { titleAngle: string; seedQuestion: string; noveltyScore?: number; riskLevel?: string };
  research?: { summary: string; claims: Claim[] };
  script?: {
    hook: string;
    beats: Beat[];
    payoff: string;
    callToAction: string;
    totalDurationSeconds: number;
  };
}

/**
 * Renders the topic + research + script for the script-approval gate. Fetches
 * /api/runs/[jobId]/artifact?name=script.json on mount.
 */
export function ScriptPreview({ jobId }: { jobId: string }) {
  const [artifact, setArtifact] = useState<ScriptArtifact | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/runs/${encodeURIComponent(jobId)}/artifact?name=script.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => alive && setArtifact(data))
      .catch((err) => alive && setError((err as Error).message));
    return () => {
      alive = false;
    };
  }, [jobId]);

  if (error) return <p className="alert-error">Could not load script.json: {error}</p>;
  if (!artifact) return <p className="text-xs text-fg-subtle">Loading script…</p>;

  const { topic, research, script } = artifact;

  return (
    <div className="space-y-5">
      {topic && (
        <section>
          <h4 className="section-title mb-2">Topic</h4>
          <p className="text-base font-semibold text-fg">{topic.titleAngle}</p>
          <p className="mt-1 text-sm text-fg-muted">{topic.seedQuestion}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
            {topic.noveltyScore !== undefined && (
              <span className="pill-info">novelty {topic.noveltyScore.toFixed(2)}</span>
            )}
            {topic.riskLevel && <span className="pill-muted">risk: {topic.riskLevel}</span>}
          </div>
        </section>
      )}

      {research && (
        <section>
          <h4 className="section-title mb-2">Research summary</h4>
          <p className="text-sm text-fg-muted">{research.summary}</p>
          <ul className="mt-3 space-y-1.5">
            {research.claims.map((c, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span className="pill-muted shrink-0">{c.confidence}</span>
                <span className="flex-1 text-fg">{c.claim}</span>
                <span className="text-fg-subtle">{c.sourceLabels.join(", ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {script && (
        <section>
          <h4 className="section-title mb-2">Script · ~{script.totalDurationSeconds}s</h4>
          <ScriptBlock label="Hook" body={script.hook} />
          <ol className="mt-3 space-y-2">
            {script.beats.map((b, i) => (
              <li key={i} className="card-elev p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
                  Beat {i + 1}
                </div>
                <p className="mt-1 text-sm text-fg">{b.narration}</p>
                <p className="mt-1 text-xs italic text-fg-muted">▸ {b.visualIntent}</p>
              </li>
            ))}
          </ol>
          <ScriptBlock label="Payoff" body={script.payoff} className="mt-3" />
          <ScriptBlock label="CTA" body={script.callToAction} className="mt-2" />
        </section>
      )}
    </div>
  );
}

function ScriptBlock({
  label,
  body,
  className = "",
}: {
  label: string;
  body: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">{label}</div>
      <p className="mt-1 text-sm text-fg">{body}</p>
    </div>
  );
}
