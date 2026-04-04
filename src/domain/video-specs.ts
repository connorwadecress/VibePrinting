export interface CaptionStyle {
  fontSize: number;
  fontColor: string;
  borderWidth: number;
  borderColor: string;
  yPosition: string; // ffmpeg expression, e.g. "h-h/5"
}

/**
 * Video output specification — defines resolution, codec, and caption styling.
 * Replaces hardcoded values in ffmpeg.ts (1080x1920, 30fps, libx264, etc.)
 */
export interface VideoSpec {
  width: number;
  height: number;
  fps: number;
  codec: string;
  preset: string;
  crf: number;
  audioCodec: string;
  audioBitrate: string;
  captionStyle: CaptionStyle;
}

/** Standard YouTube Shorts / TikTok portrait format */
export const SHORTS_PORTRAIT: VideoSpec = {
  width: 1080,
  height: 1920,
  fps: 30,
  codec: "libx264",
  preset: "medium",
  crf: 23,
  audioCodec: "aac",
  audioBitrate: "128k",
  captionStyle: {
    fontSize: 42,
    fontColor: "white",
    borderWidth: 3,
    borderColor: "black",
    yPosition: "h-h/5",
  },
};

/** Standard 16:9 landscape format (for future long-form content) */
export const LANDSCAPE_HD: VideoSpec = {
  width: 1920,
  height: 1080,
  fps: 30,
  codec: "libx264",
  preset: "medium",
  crf: 23,
  audioCodec: "aac",
  audioBitrate: "128k",
  captionStyle: {
    fontSize: 36,
    fontColor: "white",
    borderWidth: 2,
    borderColor: "black",
    yPosition: "h-h/8",
  },
};
