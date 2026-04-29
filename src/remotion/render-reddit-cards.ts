import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, ensureBrowser } from "@remotion/renderer";
import { wordTimingsToPages } from "./captions.js";
import type {
  RedditLaneConfig,
  RedditStorySegment,
  WordTiming,
} from "../domain/models.js";
import type { VideoSpec } from "../domain/video-specs.js";
import type { AnimatedCaptionConfig } from "./styles.js";
import { log, logTiming } from "../utils/logger.js";

export interface RenderRedditCardsOptions {
  videoPath: string;
  durationSeconds: number;
  videoSpec: VideoSpec;
  outputPath: string;
  segments: RedditStorySegment[];
  subreddit: string;
  wordTimings: WordTiming[];
  captionConfig?: Partial<AnimatedCaptionConfig>;
  laneConfig?: RedditLaneConfig;
}

export async function renderRedditCards(
  options: RenderRedditCardsOptions,
): Promise<string> {
  const start = Date.now();
  const {
    videoPath,
    durationSeconds,
    videoSpec,
    outputPath,
    segments,
    subreddit,
    wordTimings,
    captionConfig,
    laneConfig,
  } = options;

  log("reddit-caption-overlay", "Ensuring browser for Remotion rendering...");
  await ensureBrowser();

  log("reddit-caption-overlay", "Bundling Remotion composition...");
  const entryPoint = path.resolve(import.meta.dirname, "index.ts");

  const bundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        extensionAlias: {
          ".js": [".js", ".ts", ".tsx"],
        },
      },
    }),
  });

  // Copy assembled video into the bundle's public dir so Remotion can serve it via HTTP.
  const publicDir = path.join(bundleLocation, "public");
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  const videoFileName = "source-video.mp4";
  fs.copyFileSync(videoPath, path.join(publicDir, videoFileName));

  const pages = wordTimingsToPages(wordTimings);
  log(
    "reddit-caption-overlay",
    `Generated ${pages.length} caption pages from ${wordTimings.length} words across ${segments.length} segments`,
  );

  const inputProps = {
    videoSrc: videoFileName,
    segments,
    subreddit,
    pages,
    captionConfig,
    cardInitialReveal: laneConfig?.cardInitialReveal ?? "empty",
    cardMaxHeightPx: laneConfig?.cardMaxHeightPx ?? 1100,
  };

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "RedditCardsOverlay",
    inputProps,
  });

  const durationInFrames = Math.ceil(durationSeconds * videoSpec.fps);

  log(
    "reddit-caption-overlay",
    `Rendering ${durationInFrames} frames at ${videoSpec.fps}fps...`,
  );
  await renderMedia({
    composition: {
      ...composition,
      width: videoSpec.width,
      height: videoSpec.height,
      fps: videoSpec.fps,
      durationInFrames,
    },
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: outputPath,
    inputProps,
    timeoutInMilliseconds: 1_800_000,
  });

  logTiming("reddit-caption-overlay", start);
  return outputPath;
}
