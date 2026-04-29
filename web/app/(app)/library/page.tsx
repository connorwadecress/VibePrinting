import { listLibrary } from "@/lib/shared-library";
import { SharedLibraryEditor } from "@/components/SharedLibraryEditor";

/**
 * /library — cross-brand shared asset library.
 *
 * Shows the gameplay and music pools every brand on the instance reads
 * from. Per-brand allowlisting/ordering still happens on each brand's
 * "Asset library" panel in the brand editor — this page only manages
 * what files exist on disk.
 *
 * Auth is enforced upstream by middleware.ts.
 */

export const dynamic = "force-dynamic";

export default function SharedLibraryPage() {
  const gameplay = listLibrary("gameplay");
  const music = listLibrary("music");

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          Shared library
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-fg-muted">
          Background gameplay clips and music tracks pulled by every brand&rsquo;s
          reddit-story lanes. Files live on the host&rsquo;s{" "}
          <code className="font-mono text-xs">shared/</code> volume. Each
          brand picks which of these files it&rsquo;s allowed to use from its{" "}
          <em>Asset library</em> panel in the brand editor.
        </p>
      </header>

      <SharedLibraryEditor
        kind="gameplay"
        title="Gameplay clips"
        description="Long-form .mp4 / .mov files. The pipeline crops a random slice equal to the narration length, so duplicates between brands are fine."
        initial={gameplay}
      />

      <SharedLibraryEditor
        kind="music"
        title="Music tracks"
        description=".mp3 / .m4a / .wav background music. Tracks shorter than the narration are looped."
        initial={music}
      />
    </section>
  );
}
