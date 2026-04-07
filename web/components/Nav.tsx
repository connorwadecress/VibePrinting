"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Top header nav. Four items, brand mark on the left, version on the
 * right. Renders on every page except /login (the login layout doesn't
 * include it). Dracula palette.
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
    <header className="sticky top-0 z-20 border-b border-dracula-line bg-dracula-bg/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-8 px-8">
        <Link href="/brands" className="flex items-baseline gap-2">
          <span className="text-sm font-semibold tracking-tight text-dracula-purple">
            VibePrinting
          </span>
          <span className="text-xs text-dracula-comment">Admin</span>
        </Link>
        <nav className="flex-1">
          <ul className="flex items-center gap-1">
            {ITEMS.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={
                      "block rounded-md px-3 py-1.5 text-sm transition-colors " +
                      (active
                        ? "bg-dracula-line font-medium text-dracula-pink"
                        : "text-dracula-fg hover:bg-dracula-line hover:text-dracula-cyan")
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="text-xs text-dracula-comment">v0.2</div>
      </div>
    </header>
  );
}
