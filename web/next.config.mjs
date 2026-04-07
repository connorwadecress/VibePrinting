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
  // node-cron uses Node.js built-ins (path, child_process, fs) that the
  // webpack bundler cannot resolve for the browser target. Mark it external
  // so Next.js requires it natively at runtime instead of bundling it.
  serverExternalPackages: ["node-cron"],
  // Allow tracing file references outside the web/ workspace so the Next
  // build picks up `../src/**` imports at build time.
  outputFileTracingRoot: new URL("..", import.meta.url).pathname,
  experimental: {
    // Reserved for instrumentation hooks in later phases.
  },
  // The pipeline (../src/**) is authored as ESM TypeScript with explicit
  // ".js" relative imports (NodeNext convention). Webpack does not honor
  // tsconfig's bundler-style ".js"->".ts" remap on its own, so we wire
  // up an extensionAlias to make those imports resolvable when the
  // admin UI imports pipeline modules at runtime.
  webpack(config, { isServer }) {
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    if (isServer) {
      // node-cron and several lib files use Node.js built-ins with the
      // "node:" URI scheme (e.g. node:child_process). Webpack doesn't
      // handle that scheme by default, so mark them as CJS externals so
      // Node resolves them natively at runtime.
      const existing = Array.isArray(config.externals)
        ? config.externals
        : config.externals
        ? [config.externals]
        : [];
      config.externals = [
        ...existing,
        "node-cron",
        ({ request }, callback) => {
          if (request?.startsWith("node:")) {
            return callback(null, "commonjs " + request.slice(5));
          }
          callback();
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
