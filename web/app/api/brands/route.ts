/**
 * GET /api/brands
 *
 * Returns a summary list of brands visible to the current session.
 * Admin sessions see all brands; per-user sessions see only their
 * owned brands.
 *
 * Response: { brands: BrandSummary[] }
 */

import { requireAuth, filterBrands } from "@/lib/auth";
import { listBrandIds, summarizeBrand } from "@/lib/brand-io";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { BRANDS_DIR } = await import("@/lib/paths");
    console.log("[brands] GET /api/brands — BRANDS_DIR:", BRANDS_DIR);
    const allIds = listBrandIds();
    const visibleIds = filterBrands(allIds, auth);
    const brands = visibleIds.map(summarizeBrand);
    console.log("[brands] Visible brands for", auth.userId, ":", visibleIds);
    return new Response(JSON.stringify({ brands }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[brands] Error listing brands:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? String(err) }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
