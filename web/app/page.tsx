/**
 * Phase 0 stub. This page exists only so `next dev` / `next build` has a
 * root route to render. It will be replaced with a redirect to `/brands`
 * in Phase 3 once auth and the brand list land.
 */
export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-10">
      <h1 className="text-2xl font-semibold tracking-tight">VibePrinting Admin</h1>
      <p className="mt-3 text-sm text-neutral-500">
        Phase 0 scaffold. Brand editor, runs, schedule, and upload history
        arrive in later phases.
      </p>
      <div className="mt-8 rounded-md border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
        <p className="font-medium text-neutral-900">What works today</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-600">
          <li>Workspace scaffold and Tailwind pipeline</li>
          <li>Pipeline engine unchanged and still runnable via <code className="font-mono text-neutral-900">npm run generate</code></li>
        </ul>
      </div>
    </main>
  );
}
