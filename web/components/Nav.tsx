"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandSwitcher } from "@/components/BrandSwitcher";

/**
 * Top header nav. Brand mark, four sections, active-brand switcher,
 * version tag. On small screens the section list collapses behind a
 * hamburger toggle.
 *
 * The brand switcher scopes the entire UI to one brand at a time —
 * every page in the (app) group reads the vp_active_brand cookie
 * during SSR and filters its data accordingly.
 */

const ITEMS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/brands", label: "Brands" },
  { href: "/runs", label: "Runs" },
  { href: "/schedule", label: "Schedule" },
  { href: "/uploads", label: "Uploads" },
  { href: "/library", label: "Library" },
];

interface NavProps {
  brandIds: string[];
  activeBrandId: string | null;
}

export function Nav({ brandIds, activeBrandId }: NavProps) {
  const pathname = usePathname() ?? "/brands";
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/80 backdrop-blur-xl supports-[backdrop-filter]:bg-bg/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/brands" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent to-info text-[11px] font-bold text-white shadow-sm shadow-accent/40">
            V
          </span>
          <span className="text-sm font-semibold tracking-tight text-fg">
            VibePrinting
          </span>
          <span className="hidden text-[10px] font-medium uppercase tracking-widest text-fg-subtle sm:inline">
            admin
          </span>
        </Link>

        <nav className="ml-2 hidden flex-1 md:block">
          <ul className="flex items-center gap-1">
            {ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={
                      "relative block rounded-lg px-3 py-2 text-sm transition-colors " +
                      (active
                        ? "bg-accent/15 text-accent"
                        : "text-fg-muted hover:bg-surface-2 hover:text-fg")
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <BrandSwitcher brandIds={brandIds} activeBrandId={activeBrandId} />
          <button
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="grid size-11 place-items-center rounded-lg border border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg md:hidden"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              {open ? (
                <>
                  <path d="M3 3l10 10" />
                  <path d="M13 3L3 13" />
                </>
              ) : (
                <>
                  <path d="M2 4h12" />
                  <path d="M2 8h12" />
                  <path d="M2 12h12" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-border/70 bg-bg/90 px-4 py-2 backdrop-blur md:hidden">
          <ul className="flex flex-col gap-1">
            {ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={
                      "block rounded-lg px-3 py-3 text-base font-medium transition-colors " +
                      (active
                        ? "bg-accent/15 text-accent"
                        : "text-fg-muted hover:bg-surface-2 hover:text-fg")
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
