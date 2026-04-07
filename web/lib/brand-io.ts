/**
 * Brand config IO for the admin UI.
 *
 * Thin server-side wrapper around the pipeline's brand-resolver. The
 * web layer never re-implements brand discovery; it re-uses
 * {@link listBrands} from src/utils/brand-resolver.ts so there is
 * exactly one source of truth.
 *
 * All writes go through writeBrandProfile which zod-validates the
 * payload before atomically rewriting channel.json via temp+rename.
 */

import fs from "node:fs";
import path from "node:path";
import { ChannelProfileSchema, type ChannelProfileInput } from "@/lib/zod-schemas";
import { brandProfilePath, BRANDS_DIR } from "@/lib/paths";
import { listBrands } from "@pipeline/utils/brand-resolver";
import { loadProfile } from "@pipeline/domain/channel-profile";
import type { ChannelProfile } from "@pipeline/domain/channel-profile";

export interface BrandSummary {
  id: string;
  displayName: string;
  thesis: string;
  laneCount: number;
  hasChannelJson: boolean;
}

/**
 * List all brand ids discoverable under brands/. Re-uses the pipeline's
 * listBrands helper so _template is automatically excluded.
 */
export function listBrandIds(): string[] {
  // Ensure we read from the resolved BRANDS_DIR. listBrands() uses
  // the cwd-relative "brands" directory; when VP_BRANDS_DIR is set
  // (e.g. in tests), we fall through to our own scan.
  if (BRANDS_DIR === path.resolve(process.cwd(), "brands")) {
    return listBrands();
  }
  if (!fs.existsSync(BRANDS_DIR)) return [];
  return fs
    .readdirSync(BRANDS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort();
}

/**
 * Load the full ChannelProfile for a brand. Throws a descriptive
 * error if the brand has no channel.json yet.
 */
export function readBrandProfile(brandId: string): ChannelProfile {
  const filePath = brandProfilePath(brandId);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Brand "${brandId}" has no channel.json at ${filePath}`);
  }
  return loadProfile(filePath);
}

/**
 * Return a lightweight summary for the brand list page.
 * Missing channel.json is non-fatal — the brand is still surfaced
 * so the operator can see something's wrong.
 */
export function summarizeBrand(brandId: string): BrandSummary {
  const filePath = brandProfilePath(brandId);
  if (!fs.existsSync(filePath)) {
    return { id: brandId, displayName: brandId, thesis: "", laneCount: 0, hasChannelJson: false };
  }
  try {
    const profile = loadProfile(filePath);
    return {
      id: profile.id,
      displayName: profile.displayName,
      thesis: profile.thesis,
      laneCount: profile.contentLanes.length,
      hasChannelJson: true,
    };
  } catch {
    return { id: brandId, displayName: brandId, thesis: "", laneCount: 0, hasChannelJson: false };
  }
}

export function listBrandSummaries(): BrandSummary[] {
  return listBrandIds().map(summarizeBrand);
}

/**
 * Validate + atomically write a ChannelProfile to brands/<id>/channel.json.
 *
 * Throws a ZodError if validation fails so the API route can serialize
 * the details and return a 400. Writes via temp + rename so partial
 * writes never land on disk.
 */
export function writeBrandProfile(brandId: string, profile: unknown): ChannelProfileInput {
  const validated = ChannelProfileSchema.parse(profile);
  if (validated.id !== brandId) {
    throw new Error(`Brand id mismatch: URL says "${brandId}", payload says "${validated.id}"`);
  }
  const filePath = brandProfilePath(brandId);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    throw new Error(`Brand folder missing: ${dir}`);
  }
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(validated, null, 2) + "\n");
  fs.renameSync(tmp, filePath);
  return validated;
}
