/**
 * POST /api/active-brand
 *
 * Body: { brandId: string }
 *
 * Persists the operator's active-brand choice to the vp_active_brand
 * cookie. Every page in the (app) group reads this cookie to scope
 * its data to a single brand. Validates that the brand exists on
 * disk before writing — an unknown id returns 400 and leaves the
 * cookie untouched.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listBrandIds } from "@/lib/brand-io";
import { ACTIVE_BRAND_COOKIE, ACTIVE_BRAND_COOKIE_MAX_AGE } from "@/lib/active-brand";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { brandId?: unknown };
  try {
    body = (await request.json()) as { brandId?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const brandId = typeof body.brandId === "string" ? body.brandId : "";
  if (!brandId) {
    return NextResponse.json({ error: "brandId required" }, { status: 400 });
  }
  const known = listBrandIds();
  if (!known.includes(brandId)) {
    return NextResponse.json({ error: `unknown brand "${brandId}"` }, { status: 400 });
  }

  const jar = await cookies();
  jar.set(ACTIVE_BRAND_COOKIE, brandId, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: ACTIVE_BRAND_COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return NextResponse.json({ ok: true, brandId });
}
