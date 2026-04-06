import React from "react";
import { spring, useVideoConfig } from "remotion";
import { AnimatedWord } from "./AnimatedWord.js";
import type { TikTokToken } from "./captions.js";
import type { AnimatedCaptionConfig } from "./styles.js";

interface CaptionPageProps {
  tokens: TikTokToken[];
  pageStartFrame: number;
  currentFrame: number;
  currentMs: number;
  config: AnimatedCaptionConfig;
}

export const CaptionPage: React.FC<CaptionPageProps> = ({
  tokens,
  pageStartFrame,
  currentFrame,
  currentMs,
  config,
}) => {
  const { fps, width } = useVideoConfig();

  const localFrame = currentFrame - pageStartFrame;
  const entranceProgress = spring({
    fps,
    frame: localFrame,
    config: { damping: 12, mass: 0.5, stiffness: 200 },
    durationInFrames: config.animationDurationFrames,
  });

  const scale = 0.7 + 0.3 * entranceProgress;
  const opacity = entranceProgress;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: "0.1em",
        maxWidth: width * 0.85,
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      {tokens.map((token, i) => {
        const isActive =
          currentMs >= token.fromMs && currentMs < token.toMs;
        return (
          <AnimatedWord
            key={`${token.fromMs}-${i}`}
            text={token.text}
            isActive={isActive}
            config={config}
          />
        );
      })}
    </div>
  );
};
