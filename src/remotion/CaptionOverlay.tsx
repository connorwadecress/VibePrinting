import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CaptionPage } from "./CaptionPage.js";
import type { TikTokPage } from "./captions.js";
import type { AnimatedCaptionConfig } from "./styles.js";
import { DEFAULT_CAPTION_CONFIG } from "./styles.js";

export interface CaptionOverlayProps {
  videoSrc: string;
  pages: TikTokPage[];
  captionConfig?: Partial<AnimatedCaptionConfig>;
}

export default function CaptionOverlay(props: Record<string, unknown>) {
  const { videoSrc, pages, captionConfig } = props as unknown as CaptionOverlayProps;
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  const config: AnimatedCaptionConfig = {
    ...DEFAULT_CAPTION_CONFIG,
    ...captionConfig,
  };

  const activePage = pages.find(
    (p) => currentMs >= p.startMs && currentMs < p.startMs + p.durationMs,
  );

  return (
    <AbsoluteFill>
      <OffthreadVideo src={staticFile(videoSrc)} />
      {activePage && (
        <div
          style={{
            position: "absolute",
            bottom: height * ((100 - config.yPositionPercent) / 100),
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <CaptionPage
            tokens={activePage.tokens}
            pageStartFrame={Math.round((activePage.startMs / 1000) * fps)}
            currentFrame={frame}
            currentMs={currentMs}
            config={config}
          />
        </div>
      )}
    </AbsoluteFill>
  );
}
