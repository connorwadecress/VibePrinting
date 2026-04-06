import { createClient, type Videos, type ErrorResponse } from "pexels";
import type { FootageProvider, FootageSearchContext } from "../../domain/interfaces/footage-provider.js";
import type { ClipCandidate, StockClip } from "../../domain/models.js";
import type { LlmClient } from "../../domain/interfaces/llm-client.js";
import { scoreCandidate } from "../../utils/clip-scorer.js";
import { downloadFile } from "../../utils/fs-helpers.js";
import { log } from "../../utils/logger.js";
import path from "node:path";

function isError(res: Videos | ErrorResponse): res is ErrorResponse {
  return "error" in res;
}

const BLOCKED_KEYWORDS = [
  "subscribe", "like button", "notification", "notification bell",
  "youtube", "social media button", "follow", "bell icon",
];

function isBlockedKeyword(keyword: string): boolean {
  const lower = keyword.toLowerCase();
  return BLOCKED_KEYWORDS.some((blocked) => lower.includes(blocked));
}

/** Select the best video file variant (prefer HD portrait). */
function selectBestFile(video: { video_files: Array<{ quality: string; height: number | null; width: number | null; link: string; id: number }> }) {
  return (
    video.video_files.find(
      (f) => f.quality === "hd" && f.height != null && f.width != null && f.height >= f.width,
    ) ??
    video.video_files.find((f) => f.quality === "hd") ??
    video.video_files.find((f) => f.quality === "sd") ??
    video.video_files[0]
  );
}

const RERANK_SYSTEM = `You are selecting the best stock footage clip for a video scene. Pick the clip whose visual content best matches the scene description and narration. Respond with JSON only: {"pick": <1-based index>}`;

async function rerankWithLlm(
  llm: LlmClient,
  candidates: ClipCandidate[],
  visualDescription: string,
  narration: string,
): Promise<number> {
  const listing = candidates
    .map((c, i) => `${i + 1}. ID ${c.video.id}, ${c.video.duration}s, ${c.video.width}x${c.video.height}, found by searching "${c.matchedKeyword}"`)
    .join("\n");

  const userPrompt = `Scene context:
- Visual description: "${visualDescription}"
- Narration being spoken: "${narration}"

Candidate clips:
${listing}

Which clip number (1-${candidates.length}) best matches this scene?`;

  try {
    const result = await llm.generateJSON<{ pick: number }>(RERANK_SYSTEM, userPrompt);
    const idx = result.pick - 1;
    if (idx >= 0 && idx < candidates.length) return idx;
  } catch {
    log("pexels", "LLM re-ranking failed, falling back to score-based pick");
  }
  return 0; // fallback to highest-scored
}

export class PexelsProvider implements FootageProvider {
  private readonly usedIds = new Set<number>();

  constructor(private readonly apiKey: string) {}

  async findAndDownloadClip(context: FootageSearchContext): Promise<StockClip> {
    const { keywords, targetDuration, outputDir, sceneIndex } = context;
    const client = createClient(this.apiKey);

    const safeKeywords = keywords.filter((k) => !isBlockedKeyword(k));
    const queryList = safeKeywords.length > 0 ? safeKeywords : keywords;

    // --- Phase 1: Gather candidates across ALL keywords ---
    const seenIds = new Set<number>();
    const candidates: ClipCandidate[] = [];

    for (const keyword of queryList) {
      log("pexels", `Searching: "${keyword}"`);
      const res = await client.videos.search({
        query: keyword,
        per_page: 15,
        min_duration: Math.max(targetDuration, 3),
        max_duration: Math.ceil(targetDuration * 3) || undefined,
      });
      if (isError(res)) {
        log("pexels", `Search failed for "${keyword}": ${res.error}`);
        continue;
      }

      for (const video of res.videos) {
        if (seenIds.has(video.id) || this.usedIds.has(video.id)) continue;
        seenIds.add(video.id);

        const file = selectBestFile(video);
        candidates.push({
          video: {
            id: video.id,
            width: video.width,
            height: video.height,
            duration: video.duration,
            tags: (video as any).tags ?? [],
          },
          file: {
            link: file.link,
            width: file.width,
            height: file.height,
            quality: file.quality,
          },
          matchedKeyword: keyword,
        });
      }
    }

    if (candidates.length === 0) {
      throw new Error(`No Pexels videos found for keywords: ${keywords.join(", ")}`);
    }

    // --- Phase 2: Score and rank ---
    const scored = candidates.map((c) =>
      scoreCandidate(c, {
        keywords: queryList,
        targetDuration,
        visualDescription: context.visualDescription ?? "",
      }),
    );
    scored.sort((a, b) => b.score - a.score);

    log("pexels", `Scored ${scored.length} candidates (top: ${scored[0].score.toFixed(3)}, bottom: ${scored[scored.length - 1].score.toFixed(3)})`);

    // Optional LLM re-ranking of top candidates
    let bestIdx = 0;
    if (context.llmClient && scored.length > 1) {
      const topN = scored.slice(0, Math.min(5, scored.length));
      log("pexels", `LLM re-ranking top ${topN.length} candidates...`);
      bestIdx = await rerankWithLlm(
        context.llmClient,
        topN,
        context.visualDescription ?? "",
        context.narration ?? "",
      );
    }

    const best = scored[bestIdx];
    this.usedIds.add(best.video.id);

    // --- Phase 3: Download ---
    const localPath = path.join(outputDir, `scene-${sceneIndex}-raw.mp4`);
    log("pexels", `Downloading clip ${best.video.id} (${best.video.duration}s, score: ${best.score.toFixed(3)}, query: "${best.matchedKeyword}")...`);
    await downloadFile(best.file.link, localPath);

    return {
      id: best.video.id,
      url: best.file.link,
      width: best.file.width ?? best.video.width,
      height: best.file.height ?? best.video.height,
      duration: best.video.duration,
      localPath,
      searchQuery: best.matchedKeyword,
    };
  }
}
