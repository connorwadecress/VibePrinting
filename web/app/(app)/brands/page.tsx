import { redirect } from "next/navigation";
import { resolveActiveBrand } from "@/lib/active-brand";

/**
 * /brands — always redirects to the active brand's editor page.
 *
 * The admin UI is scoped to one brand at a time via the header
 * dropdown, so there is no multi-brand index anymore. The redirect
 * target is resolved from the vp_active_brand cookie (with fallback
 * to the first available brand).
 */

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const { activeBrandId } = await resolveActiveBrand();
  if (!activeBrandId) {
    return (
      <section>
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Brands</h1>
        </header>
        <div className="rounded-xl border border-dashed border-border bg-surface/60 px-6 py-14 text-center text-sm text-fg-muted">
          No brand folders found under <code className="font-mono">brands/</code>.
        </div>
      </section>
    );
  }
  redirect(`/brands/${activeBrandId}`);
}
