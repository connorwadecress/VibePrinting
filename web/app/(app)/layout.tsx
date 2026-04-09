import { Nav } from "@/components/Nav";
import { resolveActiveBrand } from "@/lib/active-brand";

/**
 * Layout for the authenticated section of the admin UI. Renders the
 * top header nav and a content gutter. Lives in the "(app)" route
 * group so /login can render full-screen by virtue of being outside
 * this group's layout boundary.
 *
 * Resolves the active brand on every render so the header dropdown
 * always reflects the persisted cookie value.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { activeBrandId, brandIds } = await resolveActiveBrand();
  return (
    <div className="flex min-h-screen flex-col">
      <Nav brandIds={brandIds} activeBrandId={activeBrandId} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
