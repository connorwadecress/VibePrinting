import Link from "next/link";
import { readBrandProfile, listBrandAssets, type BrandAssetLists } from "@/lib/brand-io";
import { readBrandEnv } from "@/lib/brand-env-io";
import { BrandForm } from "@/components/BrandForm";
import { BrandEnvEditor } from "@/components/BrandEnvEditor";
import { BrandJsonEditor } from "@/components/BrandJsonEditor";
import { BrandTabs } from "@/components/BrandTabs";
import { resolveActiveBrand } from "@/lib/active-brand";

/**
 * Brand editor. Server component reads channel.json and the brand's
 * .env credentials, then hydrates the client components.
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
  let profileError: string | null = null;
  try {
    profile = readBrandProfile(brandId);
  } catch (err) {
    profileError = (err as Error).message ?? String(err);
  }

  const assets: BrandAssetLists = listBrandAssets(brandId, profile);
  const { brandIds } = await resolveActiveBrand();
  const showBackLink = brandIds.length > 1;

  let envVars;
  try {
    envVars = readBrandEnv(brandId);
  } catch {
    envVars = null;
  }

  return (
    <section>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          {showBackLink && (
            <Link
              href="/brands"
              className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-fg"
            >
              <span aria-hidden>←</span> Brands
            </Link>
          )}
          <h1 className={"text-2xl font-semibold tracking-tight text-fg " + (showBackLink ? "mt-2" : "")}>
            {profile?.displayName ?? brandId}
          </h1>
          <p className="mt-0.5 font-mono text-xs text-fg-subtle">{brandId}</p>
        </div>
      </header>

      {profileError && <div className="mb-4 alert-error">{profileError}</div>}

      <BrandTabs
        tabs={[
          {
            id: "channel",
            label: "Channel",
            content: profile ? <BrandForm initial={profile} assets={assets} /> : null,
          },
          {
            id: "configuration",
            label: "Configuration",
            content: <BrandEnvEditor brandId={brandId} initial={envVars ?? {}} />,
          },
          {
            id: "json",
            label: "JSON",
            content: profile ? <BrandJsonEditor initial={profile} /> : null,
          },
        ]}
      />
    </section>
  );
}
