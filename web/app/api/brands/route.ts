/**
 * GET /api/brands
 *
 * Returns a summary list of all discoverable brands.
 * Response: { brands: BrandSummary[] }
 */

import { requireAuth } from "@/lib/auth";
import { listBrandSummaries } from "@/lib/brand-io";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  try {
    const { BRANDS_DIR } = await import("@/lib/paths");
    console.log("[brands] GET /api/brands — BRANDS_DIR:", BRANDS_DIR);
    const brands = listBrandSummaries();
    console.log("[brands] Found brands:", brands.map((b) => b.id));
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
