import fs from "node:fs";
import path from "node:path";
import type { ChannelProfile } from "../domain/channel-profile.js";
import type { AssetManifest, PipelineState, StoryboardDeck, StoryboardScene } from "../domain/models.js";
import { ensureDir } from "./fs-helpers.js";
import { log } from "./logger.js";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildStoryboardScenes(state: PipelineState): StoryboardScene[] {
  const script = state.script;
  const scenes = state.scenes;
  if (!script) throw new Error("No script in pipeline state");
  if (!scenes || scenes.length === 0) throw new Error("No scenes in pipeline state");

  return scenes.map((scene, index) => {
    const beat = script.beats[index];
    const narration = beat?.narration ?? scene.captions.join(" ");
    return {
      sceneIndex: scene.sceneIndex,
      title: `Scene ${String(scene.sceneIndex).padStart(2, "0")}`,
      narration,
      storyPurpose: index === 0 ? "Hook" : index === scenes.length - 1 ? "Payoff" : `Beat ${beat?.beatIndex ?? index + 1}`,
      visualIntent: beat?.visualIntent ?? scene.visualDescription,
      camera: inferCamera(scene.prompt, scene.visualDescription),
      composition: scene.prompt,
      motion: inferMotion(scene.prompt),
      caption: scene.captions.join(" / "),
      seconds: scene.seconds,
      continuityNotes: [
        `Lane: ${state.lane?.id ?? "unknown"}`,
        `Maintain brand tone and visual consistency.`,
      ],
      assetNeeds: scene.searchKeywords,
      sketchFramePath: path.join("storyboard-frames", `scene-${String(scene.sceneIndex).padStart(2, "0")}.svg`),
    };
  });
}

function inferCamera(...inputs: string[]): string {
  const text = inputs.join(" ").toLowerCase();
  if (text.includes("close-up") || text.includes("close up")) return "Close-up";
  if (text.includes("wide")) return "Wide shot";
  if (text.includes("overhead")) return "Overhead";
  if (text.includes("macro")) return "Macro";
  return "Medium shot";
}

function inferMotion(text: string): string {
  const value = text.toLowerCase();
  if (value.includes("pan")) return "Pan";
  if (value.includes("zoom")) return "Push-in";
  if (value.includes("tracking")) return "Tracking shot";
  if (value.includes("fast")) return "Fast cut";
  return "Subtle motion / cut-based progression";
}

export async function writeStoryboardArtifacts(
  workDir: string,
  runId: string,
  profile: ChannelProfile,
  state: PipelineState,
): Promise<StoryboardDeck> {
  const storyboardScenes = buildStoryboardScenes(state);

  const framesDir = path.join(workDir, "storyboard-frames");
  ensureDir(framesDir);

  // Pexels handles parallel just fine — fan out for all scenes at once.
  // On failure for a scene we fall back to writing the wireframe SVG so
  // the UI always has something to show.
  await Promise.all(
    storyboardScenes.map(async (scene) => {
      const idx = String(scene.sceneIndex).padStart(2, "0");
      const pexelsRel = path.join("storyboard-frames", `scene-${idx}.jpg`);
      const pexelsAbs = path.join(workDir, pexelsRel);
      const ok = await tryFetchPexelsPreview(scene, pexelsAbs);
      if (ok) {
        scene.sketchFramePath = pexelsRel;
      } else {
        const svgAbs = path.join(workDir, scene.sketchFramePath);
        fs.writeFileSync(svgAbs, renderStoryboardSvg(scene));
      }
    }),
  );

  // Pollinations rate-limits at ~1 concurrent request per IP — parallel
  // requests get back 429 instantly. Run them sequentially so each scene
  // has a real shot at generating; total ≈ N × ~8s.
  for (const scene of storyboardScenes) {
    const idx = String(scene.sceneIndex).padStart(2, "0");
    const aiRel = path.join("storyboard-frames", `scene-${idx}-concept.jpg`);
    const aiAbs = path.join(workDir, aiRel);
    const ok = await tryFetchPollinationsConcept(scene, runId, aiAbs);
    if (ok) scene.aiSketchPath = aiRel;
  }

  const deck: StoryboardDeck = {
    runId,
    brandId: profile.id,
    displayName: profile.displayName,
    hook: state.script?.hook ?? "",
    payoff: state.script?.payoff ?? "",
    scenes: storyboardScenes,
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(workDir, "storyboard.json"), JSON.stringify(deck, null, 2));
  fs.writeFileSync(path.join(workDir, "storyboard-deck.html"), renderStoryboardHtml(deck));

  state.storyboard = deck;
  return deck;
}

/**
 * Pull one landscape image from Pexels matching the scene's keywords and
 * write it to `targetPath`. Returns true on success, false on any failure
 * (no key, network, no results, write error). Failures are logged but
 * never throw — the caller falls back to the placeholder SVG.
 */
async function tryFetchPexelsPreview(
  scene: StoryboardScene,
  targetPath: string,
): Promise<boolean> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return false;

  const query = (scene.assetNeeds[0] ?? scene.visualIntent).trim().slice(0, 80);
  if (!query) return false;

  try {
    const url =
      `https://api.pexels.com/v1/search?per_page=1&orientation=landscape&query=` +
      encodeURIComponent(query);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return false;

    const json = (await res.json()) as {
      photos?: { src?: { large?: string; medium?: string; original?: string } }[];
    };
    const src = json.photos?.[0]?.src?.large ?? json.photos?.[0]?.src?.medium;
    if (!src) return false;

    const imgRes = await fetch(src);
    if (!imgRes.ok) return false;
    const buf = Buffer.from(await imgRes.arrayBuffer());
    fs.writeFileSync(targetPath, buf);
    return true;
  } catch (err) {
    log("storyboard", `Pexels preview failed for scene ${scene.sceneIndex}: ${(err as Error).message}`);
    return false;
  }
}

/**
 * Generate an AI concept-art sketch for the scene via Pollinations.ai.
 * Free, no auth, but slow (~5–15s per image since it generates on demand).
 * Returns true on success, false on any failure. We hard-cap at 20s so a
 * stuck request can't block the rest of the pipeline.
 *
 * Seed = `${runId}-${sceneIndex}` so re-runs of the same scene return a
 * cached image (Pollinations memoizes by full URL).
 */
async function tryFetchPollinationsConcept(
  scene: StoryboardScene,
  runId: string,
  targetPath: string,
): Promise<boolean> {
  const subject = scene.visualIntent?.trim() || scene.assetNeeds.join(", ").trim();
  if (!subject) return false;

  const stylePrefix = "Cinematic storyboard sketch, hand-drawn concept art, dramatic composition:";
  const prompt = `${stylePrefix} ${subject}`.slice(0, 480);
  // runId-sceneIndex seed → Pollinations memoizes by full URL so re-runs
  // of the same scene return cached images instantly.
  const seed = encodeURIComponent(`${runId}-${scene.sceneIndex}`);
  // turbo + 768×432 keeps generation around 5–12s per image. flux at higher
  // resolutions routinely takes 30–60s, which would block the whole stage.
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=768&height=432&nologo=true&model=turbo&seed=${seed}`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1024) return false; // sanity: real images are >1KB
    fs.writeFileSync(targetPath, buf);
    return true;
  } catch (err) {
    log(
      "storyboard",
      `Pollinations concept failed for scene ${scene.sceneIndex}: ${(err as Error).message}`,
    );
    return false;
  }
}

function renderStoryboardSvg(scene: StoryboardScene): string {
  const caption = esc(scene.caption || "—");
  const narration = esc(scene.narration);
  const visual = esc(scene.visualIntent);
  const camera = esc(scene.camera);
  const composition = esc(scene.composition);
  const motion = esc(scene.motion);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <rect width="1080" height="1920" fill="#f5f1e8" />
  <rect x="54" y="54" width="972" height="1812" rx="24" fill="none" stroke="#111" stroke-width="8" />
  <text x="90" y="130" font-family="Helvetica, Arial, sans-serif" font-size="46" font-weight="700" fill="#111">${esc(scene.title)}</text>
  <text x="90" y="185" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#333">${esc(scene.storyPurpose)} · ${scene.seconds}s</text>

  <rect x="90" y="250" width="900" height="860" rx="22" fill="#fffdf8" stroke="#111" stroke-width="5" stroke-dasharray="18 12" />
  <line x1="140" y1="380" x2="940" y2="980" stroke="#555" stroke-width="5" stroke-dasharray="24 16" />
  <line x1="940" y1="380" x2="140" y2="980" stroke="#555" stroke-width="5" stroke-dasharray="24 16" />
  <rect x="180" y="470" width="720" height="360" rx="16" fill="none" stroke="#222" stroke-width="4" />
  <text x="540" y="665" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="36" fill="#444">FRAME BLOCKING</text>
  <path d="M820 930 Q900 900 950 820" fill="none" stroke="#111" stroke-width="5" marker-end="url(#arrow)" />

  <text x="90" y="1180" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="700" fill="#111">Narration</text>
  <foreignObject x="90" y="1200" width="900" height="180">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Helvetica, Arial, sans-serif; font-size: 30px; color: #222; line-height: 1.4;">${narration}</div>
  </foreignObject>

  <text x="90" y="1430" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="700" fill="#111">Visual intent</text>
  <foreignObject x="90" y="1450" width="900" height="150">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Helvetica, Arial, sans-serif; font-size: 28px; color: #222; line-height: 1.35;">${visual}</div>
  </foreignObject>

  <text x="90" y="1655" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#222">Camera: ${camera}</text>
  <text x="90" y="1705" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#222">Composition: ${composition}</text>
  <text x="90" y="1755" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#222">Motion: ${motion}</text>

  <rect x="90" y="1800" width="900" height="72" rx="18" fill="#111" />
  <text x="540" y="1847" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="28" font-weight="700" fill="#f5f1e8">Caption: ${caption}</text>

  <defs>
    <marker id="arrow" markerWidth="16" markerHeight="16" refX="8" refY="8" orient="auto">
      <path d="M0,0 L16,8 L0,16 z" fill="#111" />
    </marker>
  </defs>
</svg>`;
}

function renderStoryboardHtml(deck: StoryboardDeck): string {
  const cards = deck.scenes
    .map(
      (scene) => `
      <article class="scene-card">
        <div class="scene-meta">
          <div>
            <h2>${esc(scene.title)}</h2>
            <p>${esc(scene.storyPurpose)} · ${scene.seconds}s</p>
          </div>
          <span class="pill">${esc(scene.camera)}</span>
        </div>
        <div class="scene-grid">
          <img src="./${scene.sketchFramePath}" alt="${esc(scene.title)} storyboard frame" />
          <div class="scene-copy">
            <section>
              <h3>Narration</h3>
              <p>${esc(scene.narration)}</p>
            </section>
            <section>
              <h3>Visual intent</h3>
              <p>${esc(scene.visualIntent)}</p>
            </section>
            <section>
              <h3>Composition</h3>
              <p>${esc(scene.composition)}</p>
            </section>
            <section>
              <h3>Motion</h3>
              <p>${esc(scene.motion)}</p>
            </section>
            <section>
              <h3>Asset needs</h3>
              <ul>${scene.assetNeeds.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
            </section>
          </div>
        </div>
      </article>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(deck.displayName)} storyboard</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: Inter, Helvetica, Arial, sans-serif; background: #f5f1e8; color: #171717; margin: 0; padding: 40px; }
    .wrap { max-width: 1200px; margin: 0 auto; }
    .hero { margin-bottom: 32px; }
    .hero h1 { margin: 0 0 8px; font-size: 40px; }
    .hero p { margin: 6px 0; color: #444; }
    .scene-card { background: rgba(255,255,255,0.9); border: 2px solid #111; border-radius: 20px; padding: 24px; margin-bottom: 24px; box-shadow: 0 12px 30px rgba(0,0,0,0.08); }
    .scene-meta { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 20px; }
    .scene-meta h2 { margin: 0 0 4px; }
    .scene-meta p { margin: 0; color: #555; }
    .pill { border: 1px solid #111; border-radius: 999px; padding: 8px 12px; font-size: 14px; font-weight: 700; }
    .scene-grid { display: grid; grid-template-columns: minmax(260px, 360px) 1fr; gap: 24px; align-items: start; }
    img { width: 100%; border-radius: 16px; border: 2px solid #111; background: #fff; }
    .scene-copy section { margin-bottom: 14px; }
    .scene-copy h3 { margin: 0 0 6px; font-size: 15px; text-transform: uppercase; letter-spacing: 0.06em; }
    .scene-copy p, .scene-copy li { margin: 0; line-height: 1.45; color: #222; }
    .scene-copy ul { margin: 0; padding-left: 20px; }
    @media (max-width: 900px) { .scene-grid { grid-template-columns: 1fr; } body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <h1>${esc(deck.displayName)} — Storyboard Deck</h1>
      <p>Run ID: ${esc(deck.runId)}</p>
      <p>Generated: ${esc(deck.generatedAt)}</p>
      <p><strong>Hook:</strong> ${esc(deck.hook)}</p>
      <p><strong>Payoff:</strong> ${esc(deck.payoff)}</p>
    </header>
    ${cards}
  </div>
</body>
</html>`;
}

export function ensureGlobalAssetManifest(workDir: string): AssetManifest {
  const assetsDir = path.join(workDir, "assets");
  ensureDir(assetsDir);

  const manifest: AssetManifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    categories: {
      storyboardTemplates: ["sketch-board-v1"],
      captionThemes: ["default-caption-theme"],
      motionPresets: ["shorts-punch-cut"],
      textures: ["paper-grain-light"],
      transitions: ["hard-cut", "quick-push"],
      musicBeds: [],
      sfx: [],
    },
  };

  fs.writeFileSync(path.join(assetsDir, "asset-manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}
