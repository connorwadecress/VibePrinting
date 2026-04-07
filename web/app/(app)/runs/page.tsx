import Link from "next/link";
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
    <section className="space-y-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Runs</h1>
        <span className="text-xs text-neutral-500">
          {active.length} active · {recent.length} recent
        </span>
      </header>

      <div>
        <h2 className="mb-2 text-sm font-medium text-neutral-700">Trigger a run</h2>
        <TriggerRunForm brands={brands} />
      </div>

      {active.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-neutral-700">Active</h2>
          <JobTable jobs={active} />
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium text-neutral-700">Recent</h2>
        {recent.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-xs text-neutral-500">
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
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-3 py-2 text-left">Started</th>
            <th className="px-3 py-2 text-left">Brand</th>
            <th className="px-3 py-2 text-left">Lane</th>
            <th className="px-3 py-2 text-left">Trigger</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.jobId} className="border-t border-neutral-100">
              <td className="px-3 py-2 font-mono text-xs text-neutral-600">
                {formatTime(j.startedAt)}
              </td>
              <td className="px-3 py-2 text-neutral-800">{j.brandId}</td>
              <td className="px-3 py-2 text-neutral-600">{j.lane ?? "(any)"}</td>
              <td className="px-3 py-2 text-xs text-neutral-500">{j.trigger}</td>
              <td className="px-3 py-2">
                <StatusPill status={j.status} />
              </td>
              <td className="px-3 py-2 text-right">
                <Link
                  href={`/runs/${j.jobId}`}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
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

function StatusPill({ status }: { status: JobRecord["status"] }) {
  const cls =
    status === "success"
      ? "bg-emerald-100 text-emerald-800"
      : status === "failed"
        ? "bg-red-100 text-red-800"
        : status === "cancelled"
          ? "bg-neutral-200 text-neutral-700"
          : "bg-indigo-100 text-indigo-800";
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
