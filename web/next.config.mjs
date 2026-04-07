/**
 * Next.js config for the VibePrinting admin UI.
 *
 * The UI workspace lives at `web/` inside the VibePrinting monorepo and
 * imports shared types/utilities from `../src/` via the `@pipeline/*` path
 * alias declared in `tsconfig.json`.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow tracing file references outside the web/ workspace so the Next
  // build picks up `../src/**` imports at build time.
  outputFileTracingRoot: new URL("..", import.meta.url).pathname,
  experimental: {
    // Reserved for instrumentation hooks in later phases.
  },
};

export default nextConfig;
