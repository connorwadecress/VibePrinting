import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob } from "@/lib/job-store";
import { RunStreamView } from "@/components/RunStreamView";

/**
 * /runs/[jobId] — single job page. Server-renders the current
 * snapshot, then hands off to <RunStreamView /> which connects to
 * the SSE stream and forwards live updates.
 */

export const dynamic = "force-dynamic";

const TERMINAL = new Set(["success", "failed", "cancelled"]);

interface PageProps {
  params: Promise<{ jobId: string }>;
}

export default async function RunPage({ params }: PageProps) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) notFound();

  const isTerminal = TERMINAL.has(job.status);
  const durationMs =
    isTerminal && job.endedAt
      ? new Date(job.endedAt).getTime() - new Date(job.startedAt).getTime()
      : null;

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/runs"
            className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-fg"
          >
            <span aria-hidden>←</span> All runs
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">
            {job.lane ?? "Random lane"}
          </h1>
          <p className="mt-0.5 font-mono text-xs text-fg-subtle">{job.jobId}</p>
        </div>
      </header>

      <dl className="card grid grid-cols-2 gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-4">
        <Meta label="Lane" value={job.lane ?? <span className="text-fg-subtle">(any)</span>} />
        <Meta label="Trigger" value={job.trigger} />
        <Meta
          label="Started"
          value={
            <span className="font-mono text-xs">{new Date(job.startedAt).toLocaleString()}</span>
          }
        />
        <Meta
          label={isTerminal ? "Finished" : "Status"}
          value={
            isTerminal && job.endedAt ? (
              <span className="font-mono text-xs">
                {new Date(job.endedAt).toLocaleString()}
                {durationMs != null && (
                  <span className="ml-1.5 text-fg-subtle">({formatDuration(durationMs)})</span>
                )}
              </span>
            ) : (
              <span className="text-fg-muted">{job.status}</span>
            )
          }
        />
        {typeof job.exitCode === "number" && (
          <Meta
            label="Exit code"
            value={
              <span
                className={
                  "font-mono text-xs " + (job.exitCode === 0 ? "text-success" : "text-danger")
                }
              >
                {job.exitCode}
              </span>
            }
          />
        )}
        {job.uploadResults && job.uploadResults.length > 0 && (
          <div className="col-span-2 sm:col-span-4">
            <dt className="label">Uploads</dt>
            <dd className="mt-1.5 flex flex-wrap gap-2">
              {job.uploadResults.map((u, i) => (
                <a
                  key={`${u.platform}-${i}`}
                  href={u.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2/60 px-2 py-1 text-xs text-fg hover:border-accent/40 hover:bg-accent/5 hover:text-accent"
                >
                  <span className="font-medium uppercase tracking-wider text-[10px] text-fg-subtle">
                    {u.platform}
                  </span>
                  <span className="truncate max-w-[18rem]">{u.title ?? u.url}</span>
                  <span aria-hidden>↗</span>
                </a>
              ))}
            </dd>
          </div>
        )}
        {job.runDir && (
          <div className="col-span-2 sm:col-span-4">
            <dt className="label">Run dir</dt>
            <dd className="mt-1 break-all font-mono text-xs text-fg-muted">{job.runDir}</dd>
          </div>
        )}
        {job.error && (
          <div className="col-span-2 sm:col-span-4">
            <dt className="label">Error</dt>
            <dd className="mt-1 break-all text-xs text-danger">{job.error}</dd>
          </div>
        )}
      </dl>

      <RunStreamView initialJob={job} />
    </section>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mt-1 text-fg-muted">{value}</dd>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = Math.floor(sec / 60);
  const remSec = Math.round(sec % 60);
  return `${min}m ${remSec}s`;
}
