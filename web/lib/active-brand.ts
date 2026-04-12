/**
 * Active-brand selection for the admin UI.
 *
 * The UI is scoped to one brand at a time via the header dropdown.
 * The selected brand is persisted in a cookie so server components
 * can read it during SSR.
 *
 * Brand list is filtered to the brands owned by the current session
 * so users never see each other's brands in the dropdown.
 */

import { cookies } from "next/headers";
import { listBrandIds } from "@/lib/brand-io";
import { getServerSession, filterBrands } from "@/lib/auth";

export const ACTIVE_BRAND_COOKIE = "vp_active_brand";
/** 365 days — UI preference, not a security token. */
export const ACTIVE_BRAND_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface ActiveBrandState {
  /** The resolved active brand id, or null if no brands are configured. */
  activeBrandId: string | null;
  /** All brand ids visible to this session. */
  brandIds: string[];
}

/**
 * Resolve the active brand for the current request.
 * Filters available brands to those owned by the current user's session.
 * Falls back to the first available brand if the cookie is missing or stale.
 */
export async function resolveActiveBrand(): Promise<ActiveBrandState> {
  const session = await getServerSession();
  const allIds = listBrandIds();
  const brandIds = session ? filterBrands(allIds, session) : [];

  if (brandIds.length === 0) {
    return { activeBrandId: null, brandIds: [] };
  }
  const jar = await cookies();
  const stored = jar.get(ACTIVE_BRAND_COOKIE)?.value;
  const activeBrandId = stored && brandIds.includes(stored) ? stored : brandIds[0];
  return { activeBrandId, brandIds };
}
