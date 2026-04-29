# syntax=docker/dockerfile:1.6
#
# VibePrinting admin UI + pipeline runner — multi-stage image.
#
# Stage 1 (builder): install all workspaces, build the Next.js admin UI.
# Stage 2 (runtime): node:20 + ffmpeg, copies the built artifacts plus
# the pipeline source so `npx tsx src/generate.ts` can be spawned by
# the web layer's job-manager at runtime.
#
# The container is a single Node process. instrumentation.ts boots the
# deletion worker and the cron scheduler alongside Next's HTTP server,
# so there is exactly one timeline for everything that happens.

# ---------------------------------------------------------------------------
# Stage 1: build
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS builder

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates python3 build-essential \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install with both workspace manifests so the install resolves the
# web/ child manifest correctly. We copy the lockfile so the install
# is deterministic.
COPY package.json package-lock.json ./
COPY web/package.json web/package.json
RUN npm ci --workspaces --include-workspace-root

COPY tsconfig.json ./
COPY src ./src
COPY web ./web

# Build the Next.js admin UI. The build needs the pipeline source
# (../src/**) on disk via the @pipeline/* path alias — that's why we
# copy src/ into the builder stage.
WORKDIR /app/web
RUN npx next build

# ---------------------------------------------------------------------------
# Stage 2: runtime
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runtime

# tini for proper signal handling, ffmpeg for the video assembler,
# ca-certificates for outbound HTTPS to LLM/upload APIs.
# Chrome/Remotion headless browser dependencies.
# python3 + yt-dlp for the reddit-story gameplay fallback provider.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    ffmpeg ca-certificates tini wget python3 \
    fonts-liberation fonts-dejavu-core \
    libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    libpango-1.0-0 libpangocairo-1.0-0 libcairo2 \
    libx11-6 libx11-xcb1 libxcb1 libxext6 \
 && rm -rf /var/lib/apt/lists/* \
 && wget -q -O /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
 && chmod a+x /usr/local/bin/yt-dlp

WORKDIR /app

ENV NODE_ENV=production
ENV TZ=America/Los_Angeles
ENV UPLOAD_LOG_PATH=/app/logs/upload-log.jsonl
ENV DELETION_QUEUE_PATH=/app/data/deletion-queue.json
ENV VP_DATA_DIR=/app/data
ENV VP_LOGS_DIR=/app/logs
ENV VP_BRANDS_DIR=/app/brands
ENV VP_OUTPUT_DIR=/app/output
ENV OUTPUT_DIR=/app/output
ENV VP_TRIGGER=cli

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/src ./src
COPY --from=builder /app/web ./web

# Volume-mount targets — created so an empty host bind mount works.
RUN mkdir -p /app/brands /app/output /app/data /app/logs

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "cd /app/web && npx next start --port 3000 --hostname 0.0.0.0"]
