/**
 * PUT /api/schedule/[brandId] — replace the full set of schedules for
 * one brand. Body is `{ schedules: ScheduleEntry[] }`. Each entry's
 * brandId must match the URL; entries without an id get one generated.
 *
 * Replace-all semantics keep the UI simple: the editor tracks the
 * whole list locally, sends the new state on save, and add/delete are
 * just array mutations on the client side.
 *
 * The scheduler picks up the new state via fs.watch on
 * `data/schedules.json`, so no restart is needed.
 */

import cron from "node-cron";
import { requireAuth, canAccessBrand, brandForbidden } from "@/lib/auth";
import {
  newScheduleId,
  replaceBrandSchedules,
  type ScheduleEntry,
  type ScheduleLaneType,
} from "@/lib/schedule-fs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ brandId: string }>;
}

const ALLOWED_PLATFORMS = new Set(["youtube", "tiktok"]);
const ALLOWED_LANE_TYPES = new Set<ScheduleLaneType>(["pexels-api", "reddit-story"]);

interface IncomingEntry {
  id?: string;
  brandId?: string;
  name?: string;
  enabled?: boolean;
  cron?: string;
  laneType?: string | null;
  lane?: string | null;
  platforms?: string[];
  dryRun?: boolean;
  skipIfRunning?: boolean;
  lastRunAt?: string | null;
  lastJobId?: string | null;
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { brandId } = await context.params;
  if (!canAccessBrand(brandId, auth)) return brandForbidden(brandId);

  let body: { schedules?: IncomingEntry[] };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!Array.isArray(body.schedules)) {
    return new Response(JSON.stringify({ error: "schedules array required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const sanitized: ScheduleEntry[] = [];
  for (const raw of body.schedules) {
    if (raw.brandId && raw.brandId !== brandId) {
      return new Response(
        JSON.stringify({ error: `schedule brandId "${raw.brandId}" does not match URL "${brandId}"` }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    const cronExpr = typeof raw.cron === "string" ? raw.cron.trim() : "";
    if (!cronExpr || !cron.validate(cronExpr)) {
      return new Response(
        JSON.stringify({ error: `invalid cron: "${raw.cron}"` }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    const laneType: ScheduleLaneType | null =
      raw.laneType && ALLOWED_LANE_TYPES.has(raw.laneType as ScheduleLaneType)
        ? (raw.laneType as ScheduleLaneType)
        : null;
    const platforms = Array.isArray(raw.platforms)
      ? raw.platforms.filter((p) => ALLOWED_PLATFORMS.has(p))
      : [];
    sanitized.push({
      id: typeof raw.id === "string" && raw.id ? raw.id : newScheduleId(),
      brandId,
      name: typeof raw.name === "string" ? raw.name : undefined,
      enabled: !!raw.enabled,
      cron: cronExpr,
      laneType,
      lane: typeof raw.lane === "string" && raw.lane ? raw.lane : null,
      platforms,
      dryRun: !!raw.dryRun,
      skipIfRunning: raw.skipIfRunning !== false,
      lastRunAt: typeof raw.lastRunAt === "string" ? raw.lastRunAt : null,
      lastJobId: typeof raw.lastJobId === "string" ? raw.lastJobId : null,
    });
  }

  const updated = replaceBrandSchedules(brandId, sanitized);
  return new Response(
    JSON.stringify({ schedules: updated.schedules.filter((s) => s.brandId === brandId) }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
