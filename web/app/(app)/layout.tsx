import { Nav } from "@/components/Nav";

/**
 * Layout for the authenticated section of the admin UI. Renders the
 * top header nav and a content gutter. Lives in the "(app)" route
 * group so /login can render full-screen by virtue of being outside
 * this group's layout boundary.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
