/**
 * Active-brand selection for the admin UI.
 *
 * The admin UI is scoped to one brand at a time. The operator picks a
 * brand from the header dropdown and every page reads this selection
 * to filter its data. The choice is persisted in a cookie so server
 * components can read it synchronously during SSR.
 *
 * If no cookie is set (first visit, cookie expired) or the stored id
 * no longer corresponds to a real brand folder, we fall back to the
 * first available brand. This guarantees server components always
 * have a brand to render against.
 */

import { cookies } from "next/headers";
import { listBrandIds } from "@/lib/brand-io";

export const ACTIVE_BRAND_COOKIE = "vp_active_brand";
/** 365 days — this is a UI preference, not a security token. */
export const ACTIVE_BRAND_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface ActiveBrandState {
  /** The resolved active brand id, or null if no brands are configured. */
  activeBrandId: string | null;
  /** All brand ids discoverable on disk. */
  brandIds: string[];
}

/**
 * Resolve the active brand for the current request. Falls back to the
 * first available brand if the cookie is missing or points at an
 * unknown id. Returns null when no brands are configured at all.
 */
export async function resolveActiveBrand(): Promise<ActiveBrandState> {
  const brandIds = listBrandIds();
  if (brandIds.length === 0) {
    return { activeBrandId: null, brandIds: [] };
  }
  const jar = await cookies();
  const stored = jar.get(ACTIVE_BRAND_COOKIE)?.value;
  const activeBrandId = stored && brandIds.includes(stored) ? stored : brandIds[0];
  return { activeBrandId, brandIds };
}
