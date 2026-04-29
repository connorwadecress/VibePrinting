import Link from "next/link";
import { TriggerRunForm, type TriggerBrandOption } from "@/components/TriggerRunForm";
import { listJobs, type JobRecord } from "@/lib/job-store";
import { readBrandProfile } from "@/lib/brand-io";
import { resolveActiveBrand } from "@/lib/active-brand";

/**
 * /runs — manual trigger form on top, then a table of recent runs.
 *
 * Scoped to the active brand from the header dropdown. The trigger
 * form only offers the active brand; the jobs table only shows jobs
 * for that brand. /runs/[jobId] still works for any historic job.
 */

export const dynamic = "force-dynamic";

const TERMINAL = new Set(["success", "failed", "cancelled"]);

export default async function RunsPage() {
  const { activeBrandId } = await resolveActiveBrand();

  const brands: TriggerBrandOption[] = [];
  if (activeBrandId) {
    try {
      const profile = readBrandProfile(activeBrandId);
      brands.push({
        id: profile.id,
        displayName: profile.displayName,
        lanes: profile.contentLanes.map((l) => ({
          id: l.id,
          description: l.description,
          type: l.type ?? "pexels-api",
        })),
      });
    } catch {
      // Active brand has no valid channel.json — fall through with empty list.
    }
  }

  const allJobs = listJobs();
  const jobs = activeBrandId
    ? allJobs.filter((j) => j.brandId === activeBrandId)
    : [];
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
            <th></th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.jobId}>
              <td data-label="Started" className="whitespace-nowrap font-mono text-xs text-fg-muted">
                {formatTime(j.startedAt)}
              </td>
              <td data-label="Brand" className="font-medium text-fg">{j.brandId}</td>
              <td data-label="Lane" className="text-fg-muted">{j.lane ?? <span className="text-fg-subtle">(any)</span>}</td>
              <td data-label="Trigger" className="text-xs text-fg-muted">{j.trigger}</td>
              <td data-label="Status">
                <StatusPill status={j.status} queuePosition={j.queuePosition} />
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

function StatusPill({ status, queuePosition }: { status: JobRecord["status"]; queuePosition?: number }) {
  const cls =
    status === "success"
      ? "pill-success"
      : status === "failed"
        ? "pill-danger"
        : status === "cancelled"
          ? "pill-muted"
          : "pill-info";
  const label =
    status === "queued" && queuePosition != null ? `queued #${queuePosition}` : status;
  return <span className={cls}>{label}</span>;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
