import Link from "next/link";
import { readBrandProfile } from "@/lib/brand-io";

/**
 * Read-only brand viewer (Phase 3). Renders every ChannelProfile field
 * in collapsible sections so the operator can verify what's on disk
 * before Phase 4 swaps this for an editable form.
 *
 * Notes:
 *  - Server component reads channel.json directly via brand-io.
 *  - Auth is enforced upstream by middleware.ts.
 *  - In Next 15 the params object is async and must be awaited.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ brandId: string }>;
}

export default async function BrandViewerPage({ params }: PageProps) {
  const { brandId } = await params;

  let profile;
  let error: string | null = null;
  try {
    profile = readBrandProfile(brandId);
  } catch (err) {
    error = (err as Error).message ?? String(err);
  }

  return (
    <section>
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <Link href="/brands" className="text-xs text-neutral-500 hover:text-neutral-700">
            ← Brands
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {profile?.displayName ?? brandId}
          </h1>
          <p className="mt-0.5 font-mono text-xs text-neutral-500">{brandId}</p>
        </div>
        <Link
          href={`/brands/${brandId}/history`}
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
        >
          Topic history
        </Link>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {profile && (
        <div className="space-y-4">
          <Card title="Thesis">
            <p className="text-sm text-neutral-700">{profile.thesis}</p>
          </Card>

          <Card title={`Content lanes (${profile.contentLanes.length})`}>
            <ul className="space-y-3">
              {profile.contentLanes.map((lane) => (
                <li key={lane.id} className="rounded-md border border-neutral-200 p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium text-neutral-900">{lane.id}</span>
                    <span className="text-xs text-neutral-500">~{lane.targetDurationSeconds}s</span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-600">{lane.description}</p>
                  {lane.exampleHooks?.length > 0 && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-neutral-500">
                      {lane.exampleHooks.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Branding">
            <Field label="YouTube category" value={profile.branding.youTubeCategory} />
            <Field label="Tags" value={profile.branding.tags.join(", ") || "—"} />
            <Field label="Hashtags" value={profile.branding.hashtags.join(" ") || "—"} />
          </Card>

          <Card title="Voiceover">
            <Field label="Provider" value={profile.ttsProvider ?? "(env default)"} />
            <Field label="Edge voice" value={profile.ttsVoice} />
            <Field label="Edge rate" value={profile.ttsRate} />
            {profile.ttsProviderSettings?.elevenLabs && (
              <>
                <Field label="ElevenLabs voiceId" value={profile.ttsProviderSettings.elevenLabs.voiceId ?? "—"} />
                <Field label="ElevenLabs modelId" value={profile.ttsProviderSettings.elevenLabs.modelId ?? "—"} />
                <Field label="ElevenLabs speed" value={String(profile.ttsProviderSettings.elevenLabs.speed ?? "—")} />
              </>
            )}
          </Card>

          <Card title="Publish slots">
            <p className="text-sm text-neutral-700">
              {profile.publishSlots?.length ? profile.publishSlots.join(", ") : "—"}
            </p>
          </Card>

          <Card title="GenSec defaults">
            <Field label="Risk level" value={profile.genSecDefaults.riskLevel} />
            <Field
              label="Disclosure required"
              value={profile.genSecDefaults.disclosureRequired ? "yes" : "no"}
            />
            <Field
              label="Safe to auto-publish"
              value={profile.genSecDefaults.safeToAutoPublish ? "yes" : "no"}
            />
            {profile.genSecDefaults.blockedReasons.length > 0 && (
              <Field label="Blocked reasons" value={profile.genSecDefaults.blockedReasons.join(", ")} />
            )}
          </Card>

          <Card title="Cleanup">
            <Field
              label="Enabled"
              value={profile.cleanup?.enabled === false ? "no" : "yes (default)"}
            />
            <Field label="Delay" value={`${profile.cleanup?.delayMinutes ?? 30} minutes`} />
          </Card>

          {profile.captionStyle && Object.keys(profile.captionStyle).length > 0 && (
            <Card title="Caption style override">
              <pre className="overflow-x-auto rounded bg-neutral-50 p-3 font-mono text-xs text-neutral-700">
                {JSON.stringify(profile.captionStyle, null, 2)}
              </pre>
            </Card>
          )}
        </div>
      )}
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-neutral-100 py-1.5 last:border-b-0">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="font-mono text-xs text-neutral-800">{value}</span>
    </div>
  );
}
