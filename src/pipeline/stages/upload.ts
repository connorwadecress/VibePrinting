import type { PipelineStage, StageContext } from "../../domain/interfaces/pipeline-stage.js";
import type { UploadMetadata, UploadResult } from "../../domain/interfaces/uploader.js";
import type { PipelineState, ShortScript } from "../../domain/models.js";
import { log, logError } from "../../utils/logger.js";

export class UploadStage implements PipelineStage {
  readonly name = "upload";

  async execute(state: PipelineState, context: StageContext): Promise<void> {
    const videoPath = state.outputVideoPath;
    const script = state.script;
    if (!videoPath) throw new Error("No output video path in pipeline state");
    if (!script) throw new Error("No script in pipeline state");

    const configuredUploaders = context.uploaders.filter((u) => u.isConfigured());

    if (configuredUploaders.length === 0) {
      log(this.name, "No upload platforms configured — skipping.");
      return;
    }

    const metadata = this.buildMetadata(script, context);
    const results: UploadResult[] = [];

    // Upload to all configured platforms in parallel
    const promises = configuredUploaders.map(async (uploader) => {
      try {
        const result = await uploader.upload(videoPath, metadata);
        results.push(result);
        log(this.name, `${result.platform}: ${result.url}`);
      } catch (err: any) {
        logError(this.name, `${uploader.platform} upload failed: ${err.message}`);
        log(this.name, "Video was saved locally. You can upload manually.");
      }
    });

    await Promise.all(promises);
    state.uploadResults = results;
  }

  private buildMetadata(script: ShortScript, context: StageContext): UploadMetadata {
    const { branding, genSecDefaults } = context.profile;
    const pub = script.publishMeta;

    // Title: prefer LLM-generated YouTube title, fall back to hook
    const rawTitle = (pub?.youtubeTitle || script.hook).replace(/[<>]/g, "").trim();
    const title = rawTitle.length > 100 ? rawTitle.substring(0, 97) + "..." : rawTitle;

    // Description: prefer LLM-generated description, fall back to narration dump
    const description = pub?.youtubeDescription
      ? [
          pub.youtubeDescription,
          "",
          "---",
          branding.hashtags.join(" "),
          ...(pub.topicHashtags ?? []).filter((h) => !branding.hashtags.includes(h)),
        ].join("\n")
      : [
          script.hook,
          "",
          script.beats.map((b) => b.narration).join(" "),
          "",
          script.payoff,
          "",
          "---",
          script.callToAction,
          "",
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
