import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import path from "node:path";
import fs from "node:fs";
import type { VideoAssembler } from "../../domain/interfaces/video-assembler.js";
import type { VideoSpec, CaptionStyle } from "../../domain/video-specs.js";
import type { SubtitleEntry } from "../../domain/models.js";
import { log } from "../../utils/logger.js";

/**
 * Builds one drawtext filter per wrapped line for a subtitle entry.
 * Using multiple filters avoids FFmpeg's unreliable \n handling in text=.
 */
function buildSubtitleFilters(
  sub: SubtitleEntry,
  fontFile: string,
  captionStyle: CaptionStyle,
  maxCharsPerLine = 28,
): string[] {
  const escape = (s: string) =>
    s
      .replace(/\\/g, "\\\\\\\\")
      .replace(/'/g, "\u2019")
      .replace(/:/g, "\\\\:")
      .replace(/%/g, "\\\\%");

  // Word-wrap into lines
  const words = sub.text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  const lineHeight = captionStyle.fontSize + 8;
  const baseY = captionStyle.yPosition;

  return lines.map((line, i) => {
    // Center all lines around baseY
    const offsetPx = Math.round((i - (lines.length - 1) / 2) * lineHeight);
    const yExpr =
      offsetPx === 0 ? baseY : offsetPx > 0 ? `(${baseY})+${offsetPx}` : `(${baseY})${offsetPx}`;

    return (
      `drawtext=fontfile='${fontFile}':` +
      `text='${escape(line)}':` +
      `fontsize=${captionStyle.fontSize}:fontcolor=${captionStyle.fontColor}:` +
      `borderw=${captionStyle.borderWidth}:bordercolor=${captionStyle.borderColor}:` +
      `x=(w-text_w)/2:y=${yExpr}:` +
      `enable='between(t,${sub.start.toFixed(2)},${sub.end.toFixed(2)})'`
    );
  });
}

export class FfmpegAssembler implements VideoAssembler {
  constructor(private readonly spec: VideoSpec) {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
    ffmpeg.setFfprobePath(ffprobeInstaller.path);
  }

  async getAudioDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) return reject(err);
        resolve(metadata.format.duration ?? 0);
      });
    });
  }

  async prepareClip(inputPath: string, outputPath: string, targetDuration: number): Promise<void> {
    const { width, height, fps } = this.spec;
    const sourceDuration = await this.getAudioDuration(inputPath).catch(() => 0);
    const needsLoop = sourceDuration > 0 && sourceDuration < targetDuration;
    log(
      "ffmpeg",
      `Preparing clip: ${path.basename(inputPath)} -> ${targetDuration.toFixed(1)}s${
        needsLoop ? ` (looping ${sourceDuration.toFixed(1)}s source)` : ""
      }`,
    );

    return new Promise((resolve, reject) => {
      const cmd = ffmpeg();
      if (needsLoop) {
        cmd.input(inputPath).inputOptions(["-stream_loop", "-1"]);
      } else {
        cmd.input(inputPath);
      }
      cmd
        .duration(targetDuration)
        .videoFilter([
          `scale=${width}:${height}:force_original_aspect_ratio=increase`,
          `crop=${width}:${height}`,
        ])
        .outputOptions(["-an", "-r", String(fps)])
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (e) => reject(e))
        .run();
    });
  }

  async concatenate(clipPaths: string[], outputPath: string): Promise<void> {
    const listFile = outputPath.replace(".mp4", "-list.txt");
    const lines = clipPaths.map((p) => `file '${p.replace(/\\/g, "/")}'`);
    fs.writeFileSync(listFile, lines.join("\n"));

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(listFile)
        .inputOptions(["-f", "concat", "-safe", "0"])
        .outputOptions(["-c", "copy"])
        .output(outputPath)
        .on("end", () => {
          try { fs.unlinkSync(listFile); } catch { /* ignore cleanup errors */ }
          resolve();
        })
        .on("error", (e) => reject(e))
        .run();
    });
  }

  async assemble(
    videoPath: string,
    audioPath: string,
    subtitles: SubtitleEntry[],
    outputPath: string,
  ): Promise<void> {
    log("ffmpeg", "Assembling final video with audio + captions...");

    const { codec, preset, crf, audioCodec, audioBitrate, fps, captionStyle } = this.spec;

    const fontFile = process.platform === "win32"
      ? "C:/Windows/Fonts/arialbd.ttf"
      : "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf";

    const drawtextFilters = subtitles.flatMap((sub) =>
      buildSubtitleFilters(sub, fontFile, captionStyle),
    );

    const vf = drawtextFilters.length > 0 ? drawtextFilters.join(",") : "null";

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions([
          "-map", "0:v",
          "-map", "1:a",
          "-c:v", codec,
          "-preset", preset,
          "-crf", String(crf),
          "-c:a", audioCodec,
          "-b:a", audioBitrate,
          "-r", String(fps),
          "-vf", vf,
        ])
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (e) => reject(e))
        .run();
    });
  }
}
