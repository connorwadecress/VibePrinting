import { ScheduleEditor, type BrandRowInput } from "@/components/ScheduleEditor";
import { listBrandIds, readBrandProfile } from "@/lib/brand-io";
import { readSchedules } from "@/lib/schedule-fs";

/**
 * /schedule — per-brand cron rows + global pause toggle. Server
 * component reads the schedules file and the brand list directly.
 */

export const dynamic = "force-dynamic";

export default function SchedulePage() {
  const data = readSchedules();
  const brandIds = listBrandIds();

  const rows: BrandRowInput[] = brandIds
    .map((id): BrandRowInput | null => {
      try {
        const profile = readBrandProfile(id);
        return {
          brandId: id,
          displayName: profile.displayName,
          lanes: profile.contentLanes.map((l) => ({ id: l.id })),
          entry: data.schedules[id] ?? null,
        };
      } catch {
        return null;
      }
    })
    .filter((r): r is BrandRowInput => r !== null);

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Schedule</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Cron-driven runs per brand. Edits hot-reload without restart.
          </p>
        </div>
        <span className="pill-muted">{rows.length} brands</span>
      </header>

      <ScheduleEditor rows={rows} initialPaused={data.globalPaused} />
    </section>
  );
}
