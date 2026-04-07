import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { TriggerRunForm, type TriggerBrandOption } from "@/components/TriggerRunForm";
import { listJobs, type JobRecord } from "@/lib/job-store";
import { listBrandIds, readBrandProfile } from "@/lib/brand-io";

/**
 * /runs — manual trigger form on top, then a table of recent runs.
 *
 * Server component. Reads brands directly from disk so the form can
 * render lane dropdowns synchronously, and pulls jobs from the
 * in-memory store. The table is just the last N records (newest
 * first); /runs/[jobId] is where the live stream lives.
 */

export const dynamic = "force-dynamic";

const TERMINAL = new Set(["success", "failed", "cancelled"]);

export default function RunsPage() {
  const brands: TriggerBrandOption[] = listBrandIds()
    .map((id) => {
      try {
        const profile = readBrandProfile(id);
        return {
          id: profile.id,
          displayName: profile.displayName,
          lanes: profile.contentLanes.map((l) => ({
            id: l.id,
            description: l.description,
          })),
        };
      } catch {
        return null;
      }
    })
    .filter((b): b is TriggerBrandOption => b !== null);

  const jobs = listJobs();
  const active = jobs.filter((j) => !TERMINAL.has(j.status));
  const recent = jobs.filter((j) => TERMINAL.has(j.status)).slice(0, 25);

  return (
    <section className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Runs</h1>
          <p className="mt-1 text-sm text-fg-muted">Trigger pipelines and watch them stream.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="pill-info">{active.length} active</span>
          <span className="pill-muted">{recent.length} recent</span>
        </div>
      </header>

      <div>
        <h2 className="section-title mb-3">Trigger a run</h2>
        <TriggerRunForm brands={brands} />
      </div>

      {active.length > 0 && (
        <div>
          <h2 className="section-title mb-3">Active</h2>
          <JobTable jobs={active} />
        </div>
      )}

      <div>
        <h2 className="section-title mb-3">Recent</h2>
        {recent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface/60 px-4 py-10 text-center text-xs text-fg-muted">
            No runs yet.
          </div>
        ) : (
          <JobTable jobs={recent} />
        )}
      </div>
    </section>
  );
}

function JobTable({ jobs }: { jobs: JobRecord[] }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Started</th>
            <th>Brand</th>
            <th>Lane</th>
            <th>Trigger</th>
            <th>Status</th>
            <th>Files</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.jobId}>
              <td className="whitespace-nowrap font-mono text-xs text-fg-muted">
                {formatTime(j.startedAt)}
              </td>
              <td className="font-medium text-fg">{j.brandId}</td>
              <td className="text-fg-muted">{j.lane ?? <span className="text-fg-subtle">(any)</span>}</td>
              <td className="text-xs text-fg-muted">{j.trigger}</td>
              <td>
                <StatusPill status={j.status} />
              </td>
              <td>
                <FilesIndicator job={j} />
              </td>
              <td className="text-right">
                <Link
                  href={`/runs/${j.jobId}`}
                  className="text-xs font-medium text-accent hover:text-accent-hover"
                >
                  view →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilesIndicator({ job }: { job: JobRecord }) {
  if (!TERMINAL.has(job.status) || !job.runDir) {
    return <span className="text-fg-subtle">—</span>;
  }
  let exists = false;
  try {
    exists = fs.existsSync(path.join(job.runDir, "final.mp4"));
  } catch {}
  return exists ? (
    <span className="pill-info">on disk</span>
  ) : (
    <span className="pill-muted">expired</span>
  );
}

function StatusPill({ status }: { status: JobRecord["status"] }) {
  const cls =
    status === "success"
      ? "pill-success"
      : status === "failed"
        ? "pill-danger"
        : status === "cancelled"
          ? "pill-muted"
          : "pill-info";
  return <span className={cls}>{status}</span>;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
