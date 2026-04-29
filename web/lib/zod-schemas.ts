/**
 * Zod schemas that mirror the pipeline's domain types. Used for:
 *  - validating PUT /api/brands/[id] payloads
 *  - validating brand form submissions on the client
 *  - as the source of truth for form generation in Phase 4
 *
 * When src/domain/channel-profile.ts grows a new field, update the
 * matching schema here.
 */

import { z } from "zod";

export const LaneTypeSchema = z.enum(["pexels-api", "reddit-story"]);

export const CommentToneSchema = z.enum(["funny", "sincere", "blend"]);

export const TrimPrioritySchema = z.enum(["comments", "body", "balanced"]);

export const RedditLaneConfigSchema = z
  .object({
    subreddit: z.string().min(1),
    showDescription: z.boolean().optional(),
    commentTone: CommentToneSchema.optional(),
    timeRange: z.enum(["day", "week", "month", "year", "all"]).optional(),
    commentCount: z.number().int().positive().optional(),
    minCommentLength: z.number().int().nonnegative().optional(),
    maxCommentLength: z.number().int().positive().optional(),
    trimPriority: TrimPrioritySchema.optional(),
    maxSpeedupPercent: z.number().nonnegative().max(50).optional(),
    segmentGapSeconds: z.number().nonnegative().optional(),
    cardInitialReveal: z.enum(["empty", "first-sentence"]).optional(),
    cardMaxHeightPx: z.number().int().positive().optional(),
  })
  .partial();

export const ContentLaneSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  targetDurationSeconds: z.number().int().positive(),
  exampleHooks: z.array(z.string()).default([]),
  type: LaneTypeSchema.optional(),
  redditConfig: RedditLaneConfigSchema.optional(),
});

export const ChannelBrandingSchema = z.object({
  tags: z.array(z.string()).default([]),
  hashtags: z.array(z.string()).default([]),
  youTubeCategory: z.string().min(1),
});

export const GenSecAssessmentSchema = z.object({
  blockedReasons: z.array(z.string()).default([]),
  disclosureRequired: z.boolean(),
  riskLevel: z.enum(["low", "medium", "high"]),
  safeToAutoPublish: z.boolean(),
});

export const ElevenLabsTtsSettingsSchema = z
  .object({
    voiceId: z.string().optional(),
    modelId: z.string().optional(),
    speed: z.number().positive().optional(),
  })
  .partial();

export const TtsProviderSettingsSchema = z
  .object({
    elevenLabs: ElevenLabsTtsSettingsSchema.optional(),
  })
  .partial();

export const CleanupConfigSchema = z.object({
  enabled: z.boolean(),
  delayMinutes: z.number().int().nonnegative(),
});

export const AssetEntrySchema = z.object({
  filename: z.string().min(1),
  enabled: z.boolean().optional(),
});

/**
 * Caption style override. Every field is optional because the pipeline
 * type is `Partial<AnimatedCaptionConfig>`. The form layer strips
 * values equal to the defaults before saving to keep overrides minimal.
 */
export const CaptionStyleSchema = z
  .object({
    fontFamily: z.string().optional(),
    fontWeight: z.number().optional(),
    fontSize: z.number().optional(),
    baseColor: z.string().optional(),
    highlightColor: z.string().optional(),
    strokeWidth: z.number().optional(),
    strokeColor: z.string().optional(),
    dropShadow: z.string().optional(),
    wordsPerPage: z.number().optional(),
    yPositionPercent: z.number().optional(),
    animationDurationFrames: z.number().optional(),
    highlightBox: z.boolean().optional(),
    highlightBoxColor: z.string().optional(),
    highlightBoxPadding: z.number().optional(),
  })
  .partial();

export const ChannelProfileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  thesis: z.string().min(1),
  contentLanes: z.array(ContentLaneSchema).min(1),
  publishSlots: z.array(z.string()).default([]),
  branding: ChannelBrandingSchema,
  ttsVoice: z.string().min(1),
  ttsRate: z.string().min(1),
  genSecDefaults: GenSecAssessmentSchema,
  captionStyle: CaptionStyleSchema.optional(),
  ttsProvider: z.enum(["edge", "elevenlabs"]).optional(),
  ttsProviderSettings: TtsProviderSettingsSchema.optional(),
  cleanup: CleanupConfigSchema.optional(),
  gameplayLibraryDir: z.string().optional(),
  musicLibraryDir: z.string().optional(),
  ytDlpFallbackUrls: z.array(z.string()).optional(),
  gameplayLibrary: z.array(AssetEntrySchema).optional(),
  musicLibrary: z.array(AssetEntrySchema).optional(),
});

export type ChannelProfileInput = z.infer<typeof ChannelProfileSchema>;
