import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import path from "node:path";
import fs from "node:fs";
import type { VideoAssembler } from "../../domain/interfaces/video-assembler.js";
import type { VideoSpec } from "../../domain/video-specs.js";
import type { SubtitleEntry } from "../../domain/models.js";
import { log } from "../../utils/logger.js";

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
    log("ffmpeg", `Preparing clip: ${path.basename(inputPath)} -> ${targetDuration}s`);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
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
      ? "C\\\\:/Windows/Fonts/arial.ttf"
      : "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

    const drawtextFilters = subtitles.map((sub) => {
      const escaped = sub.text
        .replace(/\\/g, "\\\\\\\\")
        .replace(/'/g, "\u2019")
        .replace(/:/g, "\\\\:")
        .replace(/%/g, "\\\\%");
      return (
        `drawtext=fontfile='${fontFile}':` +
        `text='${escaped}':` +
        `fontsize=${captionStyle.fontSize}:fontcolor=${captionStyle.fontColor}:` +
        `borderw=${captionStyle.borderWidth}:bordercolor=${captionStyle.borderColor}:` +
        `x=(w-text_w)/2:y=${captionStyle.yPosition}:` +
        `enable='between(t,${sub.start.toFixed(2)},${sub.end.toFixed(2)})'`
      );
    });

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
