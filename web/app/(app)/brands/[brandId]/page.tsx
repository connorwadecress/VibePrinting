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
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <Link href="/brands" className="text-xs text-neutral-500 hover:text-neutral-700">
            ← Brands
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {profile?.displayName ?? brandId}
          </h1>
          <p className="mt-0.5 font-mono text-xs text-neutral-500">{brandId}</p>
        </div>
        <Link
          href={`/brands/${brandId}/history`}
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
        >
          Topic history
        </Link>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {profile && <BrandForm initial={profile} />}
    </section>
  );
}
