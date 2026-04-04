import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import path from "node:path";
import fs from "node:fs";
import type { SubtitleEntry } from "../domain/models.js";
import { log } from "../utils/logger.js";

// Set up ffmpeg + ffprobe binary paths from their installers
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

export function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration ?? 0);
    });
  });
}

export function getVideoDuration(filePath: string): Promise<number> {
  return getAudioDuration(filePath); // same ffprobe call
}

export async function prepareClip(
  inputPath: string,
  outputPath: string,
  targetDuration: number,
): Promise<void> {
  log("ffmpeg", `Preparing clip: ${path.basename(inputPath)} -> ${targetDuration}s`);
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .duration(targetDuration)
      // Scale to fit 1080x1920 (9:16), crop center if needed
      .videoFilter([
        "scale=1080:1920:force_original_aspect_ratio=increase",
        "crop=1080:1920",
      ])
      .outputOptions(["-an", "-r", "30"])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (e) => reject(e))
      .run();
  });
}

export async function concatenateClips(
  clipPaths: string[],
  outputPath: string,
): Promise<void> {
  // Write concat list file
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
        try { fs.unlinkSync(listFile); } catch { /* ignore cleanup errors on mounted volumes */ }
        resolve();
      })
      .on("error", (e) => reject(e))
      .run();
  });
}

export async function assembleVideo(
  videoPath: string,
  audioPath: string,
  subtitles: SubtitleEntry[],
  outputPath: string,
): Promise<void> {
  log("ffmpeg", "Assembling final video with audio + captions...");

  // Build drawtext filters for captions — pick a font available on both Windows and Linux
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
      `fontsize=42:fontcolor=white:borderw=3:bordercolor=black:` +
      `x=(w-text_w)/2:y=h-h/5:` +
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
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-r", "30",
        "-vf", vf,
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (e) => reject(e))
      .run();
  });
}
