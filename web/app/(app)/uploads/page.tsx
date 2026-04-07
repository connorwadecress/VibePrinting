import { Suspense } from "react";
import { UploadHistoryTable } from "@/components/UploadHistoryTable";
import { readUploadLog, listLoggedBrands } from "@/lib/upload-log-reader";

/**
 * /uploads — read-only upload history table.
 *
 * Server-rendered list of the last N upload attempts (newest first).
 * Brand filter is a search-param so the URL is shareable. There is
 * no auto-refresh in v1; the operator reloads after a run.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ brand?: string; limit?: string }>;
}

export default async function UploadsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const brand = sp.brand?.trim() || null;
  const limit = sp.limit ? parseInt(sp.limit, 10) : 100;

  const entries = readUploadLog({
    brand: brand ?? undefined,
    limit: Number.isFinite(limit) ? limit : 100,
  });
  const brands = listLoggedBrands();

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Uploads</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Read-only feed from <code className="font-mono text-fg-subtle">logs/upload-log.jsonl</code>.
          </p>
        </div>
      </header>

      <Suspense fallback={null}>
        <UploadHistoryTable entries={entries} brands={brands} selectedBrand={brand} />
      </Suspense>
    </section>
  );
}
