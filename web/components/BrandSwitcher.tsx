"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Header-mounted active-brand selector. Writes the selection to the
 * vp_active_brand cookie via POST /api/active-brand, then refreshes
 * the current route so every server component re-reads the cookie
 * and re-renders scoped to the new brand.
 */

interface Props {
  brandIds: string[];
  activeBrandId: string | null;
}

export function BrandSwitcher({ brandIds, activeBrandId }: Props) {
  const router = useRouter();
  const [value, setValue] = useState(activeBrandId ?? "");
  const [pending, startTransition] = useTransition();

  if (brandIds.length === 0) {
    return (
      <span className="pill-warning hidden sm:inline-flex">no brands</span>
    );
  }

  if (brandIds.length < 2) {
    // No point showing a one-option dropdown — the brand is implied by the session.
    return null;
  }

  async function onChange(next: string) {
    setValue(next);
    const res = await fetch("/api/active-brand", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brandId: next }),
    });
    if (!res.ok) {
      // Roll back on failure so the select reflects the real cookie state.
      setValue(activeBrandId ?? "");
      return;
    }
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <label className="flex items-center gap-2">
      <span className="hidden text-[10px] font-medium uppercase tracking-widest text-fg-subtle sm:inline">
        brand
      </span>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        className="input input-sm w-auto min-w-[9rem]"
        aria-label="Active brand"
      >
        {brandIds.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
    </label>
  );
}
