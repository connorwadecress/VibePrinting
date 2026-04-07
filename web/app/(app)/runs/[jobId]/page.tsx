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

interface PageProps {
  params: Promise<{ jobId: string }>;
}

export default async function RunPage({ params }: PageProps) {
  const { jobId } = await params;
  const job = getJob(jobId);
  if (!job) notFound();

  return (
    <section className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Run</h1>
        <Link href="/runs" className="text-xs text-indigo-600 hover:text-indigo-800">
          ← all runs
        </Link>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-md border border-neutral-200 bg-white p-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-neutral-500">Brand</dt>
          <dd className="font-medium text-neutral-900">{job.brandId}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Lane</dt>
          <dd className="text-neutral-700">{job.lane ?? "(any)"}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Trigger</dt>
          <dd className="text-neutral-700">{job.trigger}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Started</dt>
          <dd className="font-mono text-xs text-neutral-700">
            {new Date(job.startedAt).toLocaleString()}
          </dd>
        </div>
        {job.runDir && (
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-xs text-neutral-500">Run dir</dt>
            <dd className="break-all font-mono text-xs text-neutral-700">{job.runDir}</dd>
          </div>
        )}
        {job.error && (
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-xs text-neutral-500">Error</dt>
            <dd className="break-all text-xs text-red-700">{job.error}</dd>
          </div>
        )}
      </dl>

      <RunStreamView initialJob={job} />
    </section>
  );
}
