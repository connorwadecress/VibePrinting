import fs from "node:fs";
import path from "node:path";
import type { TopicHistoryEntry } from "../domain/models.js";
import { log } from "./logger.js";

const STAGE = "topic-history";

export function loadTopicHistory(historyPath: string, outputDir: string): TopicHistoryEntry[] {
  if (fs.existsSync(historyPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
      return Array.isArray(data) ? data : [];
    } catch {
      log(STAGE, `Warning: could not parse ${historyPath}, starting fresh`);
      return [];
    }
  }

  // First run — backfill from existing script.json files
  const entries = backfillFromRuns(outputDir);
  if (entries.length > 0) {
    fs.writeFileSync(historyPath, JSON.stringify(entries, null, 2));
    log(STAGE, `Backfilled ${entries.length} topics from existing runs`);
  }
  return entries;
}

export function appendTopicHistory(historyPath: string, entry: TopicHistoryEntry): void {
  let entries: TopicHistoryEntry[] = [];
  if (fs.existsSync(historyPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
      entries = Array.isArray(data) ? data : [];
    } catch {
      // Corrupt file — start fresh with just this entry
    }
  }
  entries.push(entry);
  fs.writeFileSync(historyPath, JSON.stringify(entries, null, 2));
}

function backfillFromRuns(outputDir: string): TopicHistoryEntry[] {
  if (!fs.existsSync(outputDir)) return [];

  const entries: TopicHistoryEntry[] = [];
  const dirs = fs
    .readdirSync(outputDir)
    .filter((e) => e.startsWith("run-") && fs.statSync(path.join(outputDir, e)).isDirectory())
    .sort();

  for (const dir of dirs) {
    const scriptPath = path.join(outputDir, dir, "script.json");
    try {
      if (!fs.existsSync(scriptPath)) continue;
      const data = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
      const topic = data?.topic;
      if (!topic?.titleAngle || !topic?.seedQuestion) continue;

      const runId = dir.replace("run-", "");
      const date = runId.length >= 8
        ? `${runId.slice(0, 4)}-${runId.slice(4, 6)}-${runId.slice(6, 8)}`
        : new Date().toISOString().slice(0, 10);

      entries.push({
        laneId: topic.laneId ?? "unknown",
        titleAngle: topic.titleAngle,
        seedQuestion: topic.seedQuestion,
        runId,
        date,
      });
    } catch {
      // Skip corrupt script.json files
    }
  }

  return entries;
}
