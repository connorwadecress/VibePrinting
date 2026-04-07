import Link from "next/link";
import { listBrandSummaries, type BrandSummary } from "@/lib/brand-io";

/**
 * Brands index — plain list of brand cards. Server component reads
 * from the brand-io module directly (no API hop). Auth is enforced
 * by middleware.ts before this component renders.
 */

export const dynamic = "force-dynamic";

export default function BrandsPage() {
  let brands: BrandSummary[];
  let error: string | null = null;
  try {
    brands = listBrandSummaries();
  } catch (err) {
    brands = [];
    error = (err as Error).message ?? String(err);
  }

  return (
    <section>
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Brands</h1>
        <span className="text-xs text-neutral-500">{brands.length} configured</span>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {brands.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white px-6 py-10 text-center text-sm text-neutral-500">
          No brand folders found under <code className="font-mono">brands/</code>.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {brands.map((b) => (
            <li key={b.id}>
              <Link
                href={`/brands/${b.id}`}
                className="block rounded-md border border-neutral-200 bg-white p-4 transition-colors hover:border-indigo-300 hover:bg-indigo-50/30"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-neutral-900">{b.displayName}</span>
                  <span className="font-mono text-xs text-neutral-400">{b.id}</span>
                </div>
                {b.thesis && (
                  <p className="mt-2 line-clamp-2 text-xs text-neutral-600">{b.thesis}</p>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-neutral-500">
                  <span>{b.laneCount} lanes</span>
                  {!b.hasChannelJson && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
                      missing channel.json
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
