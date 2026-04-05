import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

export interface BrandResolution {
  brandId: string;
  profilePath: string;
  envPath: string;
  brandDir: string;
}

const BRANDS_DIR = path.resolve("brands");

/**
 * Resolves a brand ID to its file paths.
 *
 * Priority:
 * 1. Explicit brandArg (from --brand CLI flag)
 * 2. BRAND env var
 * 3. null (no brand — falls back to root channel.json / CHANNEL_PROFILE_PATH)
 */
export function resolveBrand(brandArg?: string): BrandResolution | null {
  const brandId = brandArg ?? process.env.BRAND;
  if (!brandId) return null;

  const brandDir = path.join(BRANDS_DIR, brandId);
  if (!fs.existsSync(brandDir)) {
    const available = listBrands();
    throw new Error(
      `Brand folder not found: brands/${brandId}\n` +
      `Available brands: ${available.length > 0 ? available.join(", ") : "(none)"}\n` +
      `Create a new brand by copying brands/_template/ to brands/${brandId}/`,
    );
  }

  return {
    brandId,
    profilePath: path.join(brandDir, "channel.json"),
    envPath: path.join(brandDir, ".env"),
    brandDir,
  };
}

/**
 * Loads a brand's .env file as an overlay on top of the root .env.
 * Brand values override root values for matching keys.
 */
export function loadBrandEnv(brand: BrandResolution): void {
  if (fs.existsSync(brand.envPath)) {
    dotenv.config({ path: brand.envPath, override: true });
  }
}

/**
 * Lists available brand IDs (directories in brands/ that aren't _template).
 */
export function listBrands(): string[] {
  if (!fs.existsSync(BRANDS_DIR)) return [];
  return fs.readdirSync(BRANDS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name);
}
