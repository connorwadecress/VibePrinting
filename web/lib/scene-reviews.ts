/**
 * Per-scene review state, persisted next to the storyboard artifact at
 * <runDir>/scene-reviews.json. Lets the operator approve / mark-for-changes
 * each scene independently and leave per-scene notes that the gate-level
 * decision can later aggregate.
 */

import fs from "node:fs";
import path from "node:path";

export type SceneReviewStatus = "pending" | "approved" | "changes_requested";

export interface SceneReview {
  sceneIndex: number;
  status: SceneReviewStatus;
  notes: string | null;
  reviewer: string | null;
  updatedAt: string;
}

export interface SceneReviewsFile {
  version: 1;
  reviews: Record<string, SceneReview>;
}

const FILE_NAME = "scene-reviews.json";

function filePath(runDir: string): string {
  return path.join(runDir, FILE_NAME);
}

export function readSceneReviews(runDir: string): SceneReviewsFile {
  const fp = filePath(runDir);
  if (!fs.existsSync(fp)) return { version: 1, reviews: {} };
  try {
    const data = JSON.parse(fs.readFileSync(fp, "utf-8")) as SceneReviewsFile;
    if (data?.version !== 1 || typeof data.reviews !== "object" || data.reviews === null) {
      return { version: 1, reviews: {} };
    }
    return data;
  } catch {
    // Corrupt file — start fresh rather than 500 the page.
    return { version: 1, reviews: {} };
  }
}

export function writeSceneReview(
  runDir: string,
  sceneIndex: number,
  patch: { status?: SceneReviewStatus; notes?: string | null; reviewer: string },
): SceneReview {
  const file = readSceneReviews(runDir);
  const key = String(sceneIndex);
  const current = file.reviews[key];
  const next: SceneReview = {
    sceneIndex,
    status: patch.status ?? current?.status ?? "pending",
    notes:
      patch.notes === undefined
        ? (current?.notes ?? null)
        : patch.notes && patch.notes.trim().length > 0
          ? patch.notes.trim().slice(0, 4000)
          : null,
    reviewer: patch.reviewer,
    updatedAt: new Date().toISOString(),
  };
  file.reviews[key] = next;
  const tmp = `${filePath(runDir)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(file, null, 2));
  fs.renameSync(tmp, filePath(runDir));
  return next;
}

/** Build a markdown bullet list of all scenes that have notes or non-approved status. */
export function summarizeForGate(runDir: string): string {
  const file = readSceneReviews(runDir);
  const lines: string[] = [];
  const sorted = Object.values(file.reviews).sort((a, b) => a.sceneIndex - b.sceneIndex);
  for (const r of sorted) {
    if (r.status === "approved" && !r.notes) continue;
    const tag =
      r.status === "changes_requested"
        ? "CHANGES"
        : r.status === "approved"
          ? "ok"
          : "(pending)";
    const note = r.notes ? ` — ${r.notes}` : "";
    lines.push(`- Scene ${String(r.sceneIndex).padStart(2, "0")} [${tag}]${note}`);
  }
  return lines.join("\n");
}
