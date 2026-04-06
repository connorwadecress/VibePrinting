import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, ensureBrowser } from "@remotion/renderer";
import { wordTimingsToPages } from "./captions.js";
import type { WordTiming } from "../domain/models.js";
import type { VideoSpec } from "../domain/video-specs.js";
import type { AnimatedCaptionConfig } from "./styles.js";
import { log, logTiming } from "../utils/logger.js";

export interface RenderCaptionOverlayOptions {
  videoPath: string;
  wordTimings: WordTiming[];
  durationSeconds: number;
  videoSpec: VideoSpec;
  outputPath: string;
  captionConfig?: Partial<AnimatedCaptionConfig>;
}

export async function renderCaptionOverlay(
  options: RenderCaptionOverlayOptions,
): Promise<string> {
  const start = Date.now();
  const { videoPath, wordTimings, durationSeconds, videoSpec, outputPath, captionConfig } = options;

  log("caption-overlay", "Ensuring browser for Remotion rendering...");
  await ensureBrowser();

  log("caption-overlay", "Bundling Remotion composition...");
  const entryPoint = path.resolve(
    import.meta.dirname,
    "index.ts",
  );

  const bundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => config,
  });

  const pages = wordTimingsToPages(wordTimings);
  log("caption-overlay", `Generated ${pages.length} caption pages from ${wordTimings.length} words`);

  const videoSrc = path.resolve(videoPath).replace(/\\/g, "/");

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "CaptionOverlay",
    inputProps: {
      videoSrc,
      pages,
      captionConfig,
    },
  });

  const durationInFrames = Math.ceil(durationSeconds * videoSpec.fps);

  log("caption-overlay", `Rendering ${durationInFrames} frames at ${videoSpec.fps}fps...`);
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
    inputProps: {
      videoSrc,
      pages,
      captionConfig,
    },
  });

  logTiming("caption-overlay", start);
  return outputPath;
}
