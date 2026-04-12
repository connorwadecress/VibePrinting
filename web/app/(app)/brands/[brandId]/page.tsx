import Link from "next/link";
import { readBrandProfile } from "@/lib/brand-io";
import { readBrandEnv } from "@/lib/brand-env-io";
import { BrandForm } from "@/components/BrandForm";
import { BrandEnvEditor } from "@/components/BrandEnvEditor";
import { BrandTabs } from "@/components/BrandTabs";

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

      {profileError && <div className="mb-4 alert-error">{profileError}</div>}

      <BrandTabs
        tabs={[
          {
            id: "channel",
            label: "Channel",
            content: profile ? <BrandForm initial={profile} /> : null,
          },
          {
            id: "configuration",
            label: "Configuration",
            content: <BrandEnvEditor brandId={brandId} initial={envVars ?? {}} />,
          },
        ]}
      />
    </section>
  );
}
