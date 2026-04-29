import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CaptionPage } from "./CaptionPage.js";
import { RedditCard } from "./RedditCard.js";
import type { TikTokPage } from "./captions.js";
import type { AnimatedCaptionConfig } from "./styles.js";
import { DEFAULT_CAPTION_CONFIG } from "./styles.js";
import type { RedditStorySegment } from "../domain/models.js";

export interface RedditCardsOverlayProps {
  videoSrc: string;
  segments: RedditStorySegment[];
  subreddit: string;
  pages: TikTokPage[];
  captionConfig?: Partial<AnimatedCaptionConfig>;
  cardInitialReveal?: "empty" | "first-sentence";
  cardMaxHeightPx?: number;
}

export default function RedditCardsOverlay(props: Record<string, unknown>) {
  const {
    videoSrc,
    segments,
    subreddit,
    pages,
    captionConfig,
    cardInitialReveal = "empty",
    cardMaxHeightPx = 1100,
  } = props as unknown as RedditCardsOverlayProps;
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  const config: AnimatedCaptionConfig = {
    ...DEFAULT_CAPTION_CONFIG,
    ...captionConfig,
  };

  const activeSegment = segments.find(
    (s) =>
      typeof s.startSeconds === "number" &&
      typeof s.endSeconds === "number" &&
      currentMs >= s.startSeconds * 1000 &&
      currentMs < s.endSeconds * 1000,
  );

  const activePage = pages.find(
    (p) => currentMs >= p.startMs && currentMs < p.startMs + p.durationMs,
  );

  return (
    <AbsoluteFill>
      <OffthreadVideo src={staticFile(videoSrc)} />
      {activeSegment && (
        <RedditCard
          segment={activeSegment}
          subreddit={subreddit}
          currentMs={currentMs}
          cardInitialReveal={cardInitialReveal}
          cardMaxHeightPx={cardMaxHeightPx}
        />
      )}
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
