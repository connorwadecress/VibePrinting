import Link from "next/link";
import { readBrandTopicHistory } from "@/lib/brand-io";
import { resolveActiveBrand } from "@/lib/active-brand";

/**
 * Content history — every topic the pipeline has run for the active
 * brand, regardless of lane type. Reddit-story runs surface their post
 * title and r/<sub> from topic-history.json (populated by generate.ts).
 */

export const dynamic = "force-dynamic";

export default async function ContentHistoryPage() {
  const { activeBrandId } = await resolveActiveBrand();
  const entries = activeBrandId ? readBrandTopicHistory(activeBrandId) : [];
  const sorted = entries.slice().sort((a, b) => b.runId.localeCompare(a.runId));

  return (
    <section>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/runs"
            className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-fg"
          >
            <span aria-hidden>←</span> Runs
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">
            Content history
          </h1>
          {activeBrandId && (
            <p className="mt-0.5 font-mono text-xs text-fg-subtle">{activeBrandId}</p>
          )}
        </div>
        <span className="pill-muted">{sorted.length} entries</span>
      </header>

      {!activeBrandId ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/60 px-6 py-14 text-center text-sm text-fg-muted">
          No brand selected.
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/60 px-6 py-14 text-center text-sm text-fg-muted">
          No content yet. Once you generate a few runs, they&apos;ll appear here.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Lane</th>
                <th>Title</th>
                <th>Run</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => {
                const isReddit = Boolean(e.redditPostId);
                return (
                  <tr key={`${e.runId}-${e.titleAngle}`}>
                    <td data-label="Date" className="whitespace-nowrap font-mono text-xs text-fg-muted">
                      {e.date}
                    </td>
                    <td data-label="Type">
                      <span
                        className={
                          "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                          (isReddit ? "bg-accent/10 text-accent" : "bg-surface-3 text-fg-muted")
                        }
                      >
                        {isReddit ? "Reddit" : "Topic"}
                      </span>
                    </td>
                    <td data-label="Lane" className="font-mono text-xs text-fg-muted">{e.laneId}</td>
                    <td data-label="Title">
                      <div className="font-medium text-fg">{e.titleAngle}</div>
                      {e.seedQuestion && (
                        <div className="mt-0.5 text-xs text-fg-muted">{e.seedQuestion}</div>
                      )}
                    </td>
                    <td data-label="Run" className="whitespace-nowrap font-mono text-xs text-fg-subtle">
                      {e.runId}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
