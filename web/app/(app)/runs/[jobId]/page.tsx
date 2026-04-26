import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob } from "@/lib/job-store";
import { RunDetailView } from "@/components/RunDetailView";

/**
 * /runs/[jobId] — single job page. Server-renders the current
 * snapshot, then hands off to <RunStreamView /> which connects to
 * the SSE stream and forwards live updates.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ jobId: string }>;
}

export default async function RunPage({ params }: PageProps) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) notFound();

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
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">Run</h1>
        </div>
      </header>

      <dl className="card grid grid-cols-2 gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-4">
        <Meta label="Brand" value={<span className="font-medium text-fg">{job.brandId}</span>} />
        <Meta label="Lane" value={job.lane ?? <span className="text-fg-subtle">(any)</span>} />
        <Meta label="Trigger" value={job.trigger} />
        <Meta
          label="Started"
          value={
            <span className="font-mono text-xs">{new Date(job.startedAt).toLocaleString()}</span>
          }
        />
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

      <RunDetailView initialJob={job} />
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
