"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Minimalist sidebar nav. Four items, nothing else. Renders on every
 * page except /login (the login layout doesn't include it).
 */

const ITEMS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/brands", label: "Brands" },
  { href: "/runs", label: "Runs" },
  { href: "/schedule", label: "Schedule" },
  { href: "/uploads", label: "Uploads" },
];

export function Nav() {
  const pathname = usePathname() ?? "/brands";
  return (
    <aside className="flex h-screen w-56 flex-col border-r border-neutral-200 bg-white">
      <div className="px-5 pt-6 pb-4">
        <div className="text-sm font-semibold tracking-tight text-neutral-900">VibePrinting</div>
        <div className="mt-0.5 text-xs text-neutral-500">Admin</div>
      </div>
      <nav className="flex-1 px-2">
        <ul className="space-y-0.5">
          {ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={
                    "block rounded-md px-3 py-2 text-sm transition-colors " +
                    (active
                      ? "bg-indigo-50 font-medium text-indigo-700"
                      : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900")
                  }
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="px-5 pb-5 pt-2 text-xs text-neutral-400">v0.2</div>
    </aside>
  );
}
