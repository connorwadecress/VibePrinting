import { ScheduleEditor, type BrandRowInput } from "@/components/ScheduleEditor";
import { readBrandProfile } from "@/lib/brand-io";
import { readSchedules } from "@/lib/schedule-fs";
import { resolveActiveBrand } from "@/lib/active-brand";

/**
 * /schedule — cron editor + global pause toggle for the active brand.
 * Scoped to the single brand selected in the header dropdown.
 */

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const data = readSchedules();
  const { activeBrandId } = await resolveActiveBrand();

  const rows: BrandRowInput[] = [];
  if (activeBrandId) {
    try {
      const profile = readBrandProfile(activeBrandId);
      rows.push({
        brandId: activeBrandId,
        displayName: profile.displayName,
        lanes: profile.contentLanes.map((l) => ({ id: l.id })),
        entry: data.schedules[activeBrandId] ?? null,
      });
    } catch {
      // Missing channel.json — fall through with empty rows.
    }
  }

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Schedule</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Cron-driven runs for this brand. Edits take effect immediately — no restart.
        </p>
      </header>

      <ScheduleEditor rows={rows} initialPaused={data.globalPaused} />
    </section>
  );
}
