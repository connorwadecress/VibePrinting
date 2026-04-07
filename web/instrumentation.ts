/**
 * Next.js instrumentation hook.
 *
 * Next calls this `register()` exactly once, in the Node runtime,
 * after the server starts. We use it to fire off the deletion worker
 * and the cron scheduler so they live alongside the request handlers.
 *
 * The edge runtime version is intentionally absent — none of our
 * workers can run on edge (they need fs + child_process).
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { boot } = await import("./boot");
  boot();
}
