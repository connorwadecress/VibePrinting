/**
 * PUT /api/schedule/[brandId] — upsert one brand's schedule entry.
 *
 * Body: { enabled, cron, lane, platforms, dryRun, skipIfRunning }
 * (any subset; missing fields keep their prior value).
 *
 * The scheduler picks up the new state via fs.watch on
 * `data/schedules.json` so no restart is needed.
 */

import cron from "node-cron";
import { requireAuth } from "@/lib/auth";
import { upsertSchedule, type ScheduleEntry } from "@/lib/schedule-fs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ brandId: string }>;
}

const ALLOWED_PLATFORMS = new Set(["youtube", "tiktok"]);

export async function PUT(request: Request, context: RouteContext) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { brandId } = await context.params;

  let body: Partial<ScheduleEntry>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (body.cron != null && !cron.validate(body.cron)) {
    return new Response(JSON.stringify({ error: `invalid cron: "${body.cron}"` }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const patch: Partial<ScheduleEntry> = {};
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.cron === "string") patch.cron = body.cron;
  if (body.lane === null || typeof body.lane === "string") patch.lane = body.lane;
  if (Array.isArray(body.platforms)) {
    patch.platforms = body.platforms.filter((p) => ALLOWED_PLATFORMS.has(p));
  }
  if (typeof body.dryRun === "boolean") patch.dryRun = body.dryRun;
  if (typeof body.skipIfRunning === "boolean") patch.skipIfRunning = body.skipIfRunning;

  const updated = upsertSchedule(brandId, patch);
  return new Response(JSON.stringify({ schedule: updated.schedules[brandId] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
