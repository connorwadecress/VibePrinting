import type { ContentLane, GenSecAssessment } from "./models.js";
import fs from "node:fs";
import path from "node:path";

export interface ChannelBranding {
  tags: string[];
  hashtags: string[];
  youTubeCategory: string;
}

/**
 * A complete channel identity — loaded from a user-created JSON file.
 * This is never hardcoded in source. Users create their own `channel.json`
 * from `channel.example.json` to define their brand.
 */
export interface ChannelProfile {
  id: string;
  displayName: string;
  thesis: string;
  contentLanes: ContentLane[];
  publishSlots: string[];
  branding: ChannelBranding;
  ttsVoice: string;
  ttsRate: string;
  genSecDefaults: GenSecAssessment;
}

/**
 * Loads a ChannelProfile from a JSON file.
 * Default path: `channel.json` in the project root.
 * Override via CHANNEL_PROFILE_PATH env var.
 */
export function loadProfile(filePath?: string): ChannelProfile {
  const resolvedPath = filePath
    ?? process.env.CHANNEL_PROFILE_PATH
    ?? path.resolve("channel.json");

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Channel profile not found: ${resolvedPath}\n` +
      `Copy channel.example.json to channel.json and customize it for your channel.`,
    );
  }

  const raw = fs.readFileSync(resolvedPath, "utf-8");
  const profile = JSON.parse(raw) as ChannelProfile;

  if (!profile.id || !profile.contentLanes?.length) {
    throw new Error(
      `Invalid channel profile: ${resolvedPath}\n` +
      `Must have at least "id" and one entry in "contentLanes".`,
    );
  }

  return profile;
}
