import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { UploadMetadata, UploadResult } from "../../domain/interfaces/uploader.js";
import type {
  PipelineState,
  PublishMeta,
  RedditStoryScript,
  ShortScript,
} from "../../domain/models.js";
import type { UploadLogEntry } from "../../domain/upload-log.js";
import { log, logError } from "../../utils/logger.js";
import { appendUploadLog, readTriggerFromEnv } from "../../utils/upload-log.js";
import { enqueueDeletion } from "../../utils/deletion-queue.js";
import fs from "node:fs";

interface PublishInputs {
  publishMeta?: PublishMeta;
  fallbackTitle: string;
  fallbackDescription: string;
}

export class UploadStage implements PipelineStage {
  readonly name = "upload";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    const videoPath = state.outputVideoPath;
    if (!videoPath) throw new Error("No output video path in pipeline state");

    const inputs = state.script
      ? this.fromShortScript(state.script)
      : state.redditScript
        ? this.fromRedditStoryScript(state.redditScript)
        : null;
    if (!inputs) throw new Error("No script or redditScript in pipeline state");

    const configuredUploaders = context.uploaders.filter((u) => u.isConfigured());

    if (configuredUploaders.length === 0) {
      log(this.name, "No upload platforms configured — skipping.");
      return;
    }

    const metadata = this.buildMetadata(inputs, context);
    const results: UploadResult[] = [];

    // Cache values that are identical for every parallel upload attempt.
    const fileSizeBytes = fs.existsSync(videoPath) ? fs.statSync(videoPath).size : 0;
    const trigger = readTriggerFromEnv();
    const schedulerId = process.env.VP_SCHEDULER_ID || null;
    const laneId = state.lane?.id ?? null;

    // Upload to all configured platforms in parallel
    const promises = configuredUploaders.map(async (uploader) => {
      const startMs = Date.now();
      try {
        const result = await uploader.upload(videoPath, metadata);
        results.push(result);
        log(this.name, `${result.platform}: ${result.url}`);

        const entry: UploadLogEntry = {
          ts: new Date().toISOString(),
          runId: context.runId,
          brandId: context.profile.id,
          lane: laneId,
          platform: uploader.platform,
          status: "success",
          videoId: result.id,
          url: result.url,
          title: result.title,
          durationMs: Date.now() - startMs,
          fileSizeBytes,
          error: null,
          trigger,
          schedulerId,
        };
        appendUploadLog(entry);
      } catch (err: any) {
        logError(this.name, `${uploader.platform} upload failed: ${err.message}`);
        log(this.name, "Video was saved locally. You can upload manually.");

        const entry: UploadLogEntry = {
          ts: new Date().toISOString(),
          runId: context.runId,
          brandId: context.profile.id,
          lane: laneId,
          platform: uploader.platform,
          status: "failure",
          videoId: null,
          url: null,
          title: null,
          durationMs: Date.now() - startMs,
          fileSizeBytes,
          error: err?.message ?? String(err),
          trigger,
          schedulerId,
        };
        appendUploadLog(entry);
      }
    });

    await Promise.all(promises);
    state.uploadResults = results;

    // If at least one upload succeeded and the brand allows cleanup,
    // schedule the run directory for deletion. The deletion queue file
    // is consumed by web/lib/deletion-worker.ts (Phase 6). Defaults:
    // cleanup.enabled = true, cleanup.delayMinutes = 30.
    if (results.length > 0) {
      const cleanup = context.profile.cleanup ?? { enabled: true, delayMinutes: 30 };
      if (cleanup.enabled !== false) {
        const entry = enqueueDeletion({
          runDir: context.workDir,
          brandId: context.profile.id,
          delayMinutes: cleanup.delayMinutes,
          uploadResults: results,
        });
        if (entry) {
          log(
            this.name,
            `Scheduled cleanup of ${context.workDir} at ${entry.deleteAfter}`,
          );
        }
      }
    }
  }

  private fromShortScript(script: ShortScript): PublishInputs {
    return {
      publishMeta: script.publishMeta,
      fallbackTitle: script.hook,
      fallbackDescription: [
        script.hook,
        "",
        script.beats.map((b) => b.narration).join(" "),
        "",
        script.payoff,
        "",
        "---",
        script.callToAction,
      ].join("\n"),
    };
  }

  private fromRedditStoryScript(script: RedditStoryScript): PublishInputs {
    const commentLines = script.segments
      .filter((s) => s.kind === "comment")
      .slice(0, 3)
      .map((s) => `• ${s.text.slice(0, 200)}${s.text.length > 200 ? "…" : ""}`);
    return {
      publishMeta: script.publishMeta,
      fallbackTitle: script.post.title,
      fallbackDescription: [
        `From r/${script.post.subreddit}: ${script.post.title}`,
        "",
        ...commentLines,
      ].join("\n"),
    };
  }

  private buildMetadata(inputs: PublishInputs, context: StageContext): UploadMetadata {
    const { branding, genSecDefaults } = context.profile;
    const pub = inputs.publishMeta;

    // Title: prefer LLM-generated YouTube title, fall back to provided fallback
    const rawTitle = (pub?.youtubeTitle || inputs.fallbackTitle).replace(/[<>]/g, "").trim();
    const title = rawTitle.length > 100 ? rawTitle.substring(0, 97) + "..." : rawTitle;

    // Description: prefer LLM-generated description, fall back to narrative dump
    const description = pub?.youtubeDescription
      ? [
          pub.youtubeDescription,
          "",
          "---",
          branding.hashtags.join(" "),
          ...(pub.topicHashtags ?? []).filter((h) => !branding.hashtags.includes(h)),
        ].join("\n")
      : [
          inputs.fallbackDescription,
          "",
          "---",
          branding.hashtags.join(" "),
        ].join("\n");

    // Tags: merge branding tags with LLM topic-specific tags
    const tags = [...branding.tags, ...(pub?.topicTags ?? [])];

    // Hashtags: merge branding hashtags with LLM topic-specific hashtags (deduplicated)
    const allHashtags = [...branding.hashtags];
    for (const h of pub?.topicHashtags ?? []) {
      if (!allHashtags.includes(h)) allHashtags.push(h);
    }

    return {
      title,
      description,
      tags,
      hashtags: allHashtags,
      categoryId: branding.youTubeCategory,
      disclosureRequired: genSecDefaults.disclosureRequired,
    };
  }
}
