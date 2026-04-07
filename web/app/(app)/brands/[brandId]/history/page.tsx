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
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <Link href={`/brands/${brandId}`} className="text-xs text-neutral-500 hover:text-neutral-700">
            ← {brandId}
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Topic history</h1>
        </div>
        <span className="text-xs text-neutral-500">{sorted.length} topics</span>
      </header>

      {sorted.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-sm text-neutral-500">
          No topic history yet. Once you generate a few runs, they'll appear here.
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          <table className="min-w-full divide-y divide-neutral-200 text-xs">
            <thead className="bg-neutral-50">
              <tr className="text-left text-neutral-500">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Lane</th>
                <th className="px-3 py-2 font-medium">Title angle</th>
                <th className="px-3 py-2 font-medium">Run</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sorted.map((e) => (
                <tr key={`${e.runId}-${e.titleAngle}`} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 font-mono text-neutral-600">{e.date}</td>
                  <td className="px-3 py-2 font-mono text-neutral-600">{e.laneId}</td>
                  <td className="px-3 py-2 text-neutral-900">
                    <div className="font-medium">{e.titleAngle}</div>
                    {e.seedQuestion && (
                      <div className="mt-0.5 text-neutral-500">{e.seedQuestion}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-neutral-400">{e.runId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
