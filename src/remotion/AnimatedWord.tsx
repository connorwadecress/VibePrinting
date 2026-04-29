import React from "react";
import type { AnimatedCaptionConfig } from "./styles.js";
import { EMOJI_FONT_FALLBACK } from "./fonts.js";

interface AnimatedWordProps {
  text: string;
  isActive: boolean;
  config: AnimatedCaptionConfig;
}

export const AnimatedWord: React.FC<AnimatedWordProps> = ({
  text,
  isActive,
  config,
}) => {
  const color = isActive ? config.highlightColor : config.baseColor;

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        color,
        fontFamily: `${config.fontFamily}${EMOJI_FONT_FALLBACK}`,
        fontWeight: config.fontWeight,
        fontSize: config.fontSize,
        WebkitTextStroke: `${config.strokeWidth}px ${config.strokeColor}`,
        paintOrder: "stroke fill",
        textShadow: config.dropShadow,
        marginRight: "0.25em",
        transition: "color 0.05s ease-out",
      }}
    >
      {config.highlightBox && isActive && (
        <span
          style={{
            position: "absolute",
            inset: `-${config.highlightBoxPadding}px`,
            backgroundColor: config.highlightBoxColor,
            borderRadius: 6,
            zIndex: -1,
          }}
        />
      )}
      {text}
    </span>
  );
};
