export interface AnimatedCaptionConfig {
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  baseColor: string;
  highlightColor: string;
  strokeWidth: number;
  strokeColor: string;
  dropShadow: string;
  wordsPerPage: number;
  yPositionPercent: number;
  animationDurationFrames: number;
  highlightBox: boolean;
  highlightBoxColor: string;
  highlightBoxPadding: number;
}

export const DEFAULT_CAPTION_CONFIG: AnimatedCaptionConfig = {
  fontFamily: "Montserrat",
  fontWeight: 700,
  fontSize: 64,
  baseColor: "#FFFFFF",
  highlightColor: "#FFD700",
  strokeWidth: 4,
  strokeColor: "#000000",
  dropShadow: "4px 4px 8px rgba(0,0,0,0.8)",
  wordsPerPage: 4,
  yPositionPercent: 75,
  animationDurationFrames: 8,
  highlightBox: false,
  highlightBoxColor: "rgba(255,215,0,0.3)",
  highlightBoxPadding: 6,
};
