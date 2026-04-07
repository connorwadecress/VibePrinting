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
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Brands</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Pipelines configured under <code className="font-mono text-fg-subtle">brands/</code>.
          </p>
        </div>
        <span className="pill-muted">{brands.length} configured</span>
      </header>

      {error && <div className="mb-4 alert-error">{error}</div>}

      {brands.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/60 px-6 py-14 text-center text-sm text-fg-muted">
          No brand folders found under <code className="font-mono">brands/</code>.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {brands.map((b) => (
            <li key={b.id}>
              <Link
                href={`/brands/${b.id}`}
                className="card group relative block overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-glow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-fg">{b.displayName}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-fg-subtle">{b.id}</div>
                  </div>
                  <span className="pill-muted">{b.laneCount} lanes</span>
                </div>
                {b.thesis && (
                  <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-fg-muted">
                    {b.thesis}
                  </p>
                )}
                {!b.hasChannelJson && (
                  <div className="mt-3">
                    <span className="pill-warning">missing channel.json</span>
                  </div>
                )}
                <div className="mt-4 flex items-center justify-end text-xs font-medium text-fg-subtle group-hover:text-accent">
                  Open <span className="ml-1 transition-transform group-hover:translate-x-0.5">→</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
