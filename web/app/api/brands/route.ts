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
    const brands = listBrandSummaries();
    return new Response(JSON.stringify({ brands }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? String(err) }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
