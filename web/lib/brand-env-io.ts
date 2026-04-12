/**
 * Per-brand .env file reader/writer for the admin UI.
 *
 * Only keys in BRAND_ENV_WHITELIST are exposed or modified. Keys
 * outside the whitelist are preserved in the file unchanged — we
 * never clobber unknown entries. Keys within the whitelist that are
 * absent from the file are returned as empty strings.
 *
 * File format: standard dotenv  (KEY=value, one per line, # comments).
 * Values containing spaces or special characters should be quoted —
 * we preserve the raw line format as written by existing tooling.
 */

import fs from "node:fs";
import path from "node:path";
import { BRANDS_DIR } from "@/lib/paths";
import { BRAND_ENV_WHITELIST, type BrandEnvKey, type BrandEnvMap } from "@/lib/brand-env-types";
export { BRAND_ENV_WHITELIST, type BrandEnvKey, type BrandEnvMap } from "@/lib/brand-env-types";

function envFilePath(brandId: string): string {
  return path.join(BRANDS_DIR, brandId, ".env");
}

/**
 * Parse a dotenv file into a raw key→value map (all keys, not just whitelisted).
 * Handles quoted values and inline comments only in the simplest sense —
 * good enough for machine-written credential files.
 */
function parseEnvFile(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1);
    // Strip surrounding quotes if present.
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    map.set(key, val);
  }
  return map;
}

/**
 * Serialize a key→value map back to dotenv format, preserving all lines
 * from the original file. Updated keys replace their original lines;
 * new keys are appended at the end.
 */
function serializeEnvFile(original: string, patch: Map<string, string>): string {
  const remaining = new Set(patch.keys());
  const lines: string[] = [];

  for (const raw of original.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) {
      lines.push(raw);
      continue;
    }
    const eq = line.indexOf("=");
    if (eq === -1) {
      lines.push(raw);
      continue;
    }
    const key = line.slice(0, eq).trim();
    if (patch.has(key)) {
      const newVal = patch.get(key)!;
      lines.push(`${key}=${newVal}`);
      remaining.delete(key);
    } else {
      lines.push(raw);
    }
  }

  // Append keys that didn't exist in the original file.
  for (const key of remaining) {
    lines.push(`${key}=${patch.get(key)!}`);
  }

  // Ensure a trailing newline.
  const joined = lines.join("\n");
  return joined.endsWith("\n") ? joined : joined + "\n";
}

/**
 * Read the whitelisted env vars for a brand.
 * Returns an object with all whitelisted keys; missing keys are "".
 */
export function readBrandEnv(brandId: string): BrandEnvMap {
  const filePath = envFilePath(brandId);
  const raw = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
  const parsed = parseEnvFile(raw);

  return Object.fromEntries(
    BRAND_ENV_WHITELIST.map((key) => [key, parsed.get(key) ?? ""]),
  ) as BrandEnvMap;
}

/**
 * Write a partial patch of whitelisted env vars for a brand.
 * Merges into the existing .env file without touching non-whitelisted keys.
 * Keys not present in the patch are left unchanged.
 * Pass "" to clear a key.
 */
export function writeBrandEnv(brandId: string, patch: Partial<BrandEnvMap>): BrandEnvMap {
  const filePath = envFilePath(brandId);

  // Validate that all keys in patch are whitelisted.
  const whiteset = new Set<string>(BRAND_ENV_WHITELIST);
  for (const key of Object.keys(patch)) {
    if (!whiteset.has(key)) throw new Error(`Key "${key}" is not allowed.`);
  }

  const original = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
  const patchMap = new Map(
    Object.entries(patch).filter(([, v]) => v !== undefined) as [string, string][],
  );

  const updated = serializeEnvFile(original, patchMap);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) throw new Error(`Brand folder missing: ${dir}`);

  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, updated, "utf-8");
  fs.renameSync(tmp, filePath);

  return readBrandEnv(brandId);
}
