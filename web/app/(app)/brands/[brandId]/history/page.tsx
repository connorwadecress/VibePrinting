import Link from "next/link";
import { readBrandTopicHistory } from "@/lib/brand-io";

/**
 * Read-only topic history view per brand. Reads
 * brands/<id>/topic-history.json directly via brand-io. Sorted
 * newest-first; date column is whatever the pipeline persisted.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ brandId: string }>;
}

export default async function TopicHistoryPage({ params }: PageProps) {
  const { brandId } = await params;
  const entries = readBrandTopicHistory(brandId);
  const sorted = entries.slice().sort((a, b) => b.runId.localeCompare(a.runId));

  return (
    <section>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href={`/brands/${brandId}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-fg"
          >
            <span aria-hidden>←</span> {brandId}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">
            Topic history
          </h1>
        </div>
        <span className="pill-muted">{sorted.length} topics</span>
      </header>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/60 px-6 py-14 text-center text-sm text-fg-muted">
          No topic history yet. Once you generate a few runs, they&apos;ll appear here.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Lane</th>
                <th>Title angle</th>
                <th>Run</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <tr key={`${e.runId}-${e.titleAngle}`}>
                  <td className="font-mono text-xs text-fg-muted">{e.date}</td>
                  <td className="font-mono text-xs text-fg-muted">{e.laneId}</td>
                  <td>
                    <div className="font-medium text-fg">{e.titleAngle}</div>
                    {e.seedQuestion && (
                      <div className="mt-0.5 text-xs text-fg-muted">{e.seedQuestion}</div>
                    )}
                  </td>
                  <td className="font-mono text-xs text-fg-subtle">{e.runId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
