import Link from "next/link";
import { readBrandProfile } from "@/lib/brand-io";
import { BrandForm } from "@/components/BrandForm";

/**
 * Brand editor (Phase 4). Server component reads channel.json directly
 * via brand-io and hydrates the BrandForm client component with the
 * loaded profile.
 *
 * Auth is enforced upstream by middleware.ts. In Next 15 the params
 * object is async and must be awaited.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ brandId: string }>;
}

export default async function BrandEditorPage({ params }: PageProps) {
  const { brandId } = await params;

  let profile;
  let error: string | null = null;
  try {
    profile = readBrandProfile(brandId);
  } catch (err) {
    error = (err as Error).message ?? String(err);
  }

  return (
    <section>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/brands"
            className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-fg"
          >
            <span aria-hidden>←</span> Brands
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">
            {profile?.displayName ?? brandId}
          </h1>
          <p className="mt-0.5 font-mono text-xs text-fg-subtle">{brandId}</p>
        </div>
        <Link href={`/brands/${brandId}/history`} className="btn-secondary btn-sm">
          Topic history
        </Link>
      </header>

      {error && <div className="mb-4 alert-error">{error}</div>}

      {profile && <BrandForm initial={profile} />}
    </section>
  );
}
