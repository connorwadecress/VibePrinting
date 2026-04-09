import { Suspense } from "react";
import { UploadHistoryTable } from "@/components/UploadHistoryTable";
import { readUploadLog } from "@/lib/upload-log-reader";
import { resolveActiveBrand } from "@/lib/active-brand";

/**
 * /uploads — read-only upload history table, scoped to the active
 * brand from the header dropdown.
 *
 * Server-rendered list of the last N upload attempts (newest first).
 * There is no auto-refresh; the operator reloads after a run.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ limit?: string }>;
}

export default async function UploadsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const limit = sp.limit ? parseInt(sp.limit, 10) : 100;
  const { activeBrandId } = await resolveActiveBrand();

  const entries = activeBrandId
    ? readUploadLog({
        brand: activeBrandId,
        limit: Number.isFinite(limit) ? limit : 100,
      })
    : [];

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
        <UploadHistoryTable entries={entries} activeBrandId={activeBrandId} />
      </Suspense>
    </section>
  );
}
