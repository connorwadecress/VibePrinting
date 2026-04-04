# Vibe Printing — CLAUDE.md

This file is the authoritative context document for any AI assistant working in this repo.

---

## What this project is

**Vibe Printing** is an automation-first pipeline that generates, assembles, and publishes AI-native YouTube Shorts. The channel identity is **Compressed Curiosity** — 30–45 second Shorts that explain surprising history, human performance, and everyday science through fast, story-shaped narration.

The goal is a controlled content factory, not random AI output at scale. Every Short must pass editorial and safety gates before it reaches YouTube.

---

## Tech stack

| Layer | Tool |
|---|---|
| Language | TypeScript (ESM, strict) |
| Runtime | Node.js via `tsx` |
| LLM | Claude (default) or Gemini — switchable via `LLM_PROVIDER` env var |
| TTS | `@andresaya/edge-tts` (Microsoft Edge TTS) |
| Stock footage | Pexels API |
| Video assembly | `ffmpeg` via `fluent-ffmpeg` + `@ffmpeg-installer/ffmpeg` |
| Upload | YouTube (`googleapis` OAuth2) + TikTok Content Posting API |

---

## Repo layout

```
src/
  config.ts                   — env loading + AppConfig type
  domain/models.ts            — all shared TypeScript types (source of truth)
  generate.ts                 — CLI entry point for the full pipeline
  index.ts                    — bootstrap status (prints blueprint + configured services)
  n8n-cli.ts                  — n8n workflow management CLI
  n8n-export.ts               — exports workflow JSON files
  n8n/                        — n8n API client, scope, workflow helpers
  pipeline/
    blueprint.ts              — recommendedTheme, pipelineBlueprint, defaultGenSecAssessment
    runner.ts                 — orchestrates all pipeline stages in order
    stages/                   — one file per pipeline stage (see below)
  providers/
    llm.ts                    — LlmClient abstraction (Claude + Gemini)
    ffmpeg.ts                 — prepareClip, concatenateClips, assembleVideo, duration helpers
    pexels.ts                 — stock footage search and download
    tts.ts                    — edge-tts wrapper
  utils/
    fs-helpers.ts             — createRunDir, etc.
    logger.ts                 — log, logError, logTiming
docs/                         — architecture, editorial plan, roadmap, n8n spec, workflow JSON exports
branding/                     — brand-guide.md, logo.png, banner.png
```

---

## Running the pipeline

See `package.json` for npm scripts and `.env.example` for all environment variables.

```powershell
.\generate.ps1                               # Full pipeline, random lane
.\generate.ps1 -Lane history-flash -DryRun   # Script only — no video/API calls except LLM
.\generate.ps1 -Upload                       # Full pipeline + upload to YouTube & TikTok
.\run-loop.ps1                               # Auto-generate + upload on interval (default: 20min)
.\run-loop.ps1 -IntervalMinutes 30 -RunsMax 5  # Custom interval and run cap
```

Dry-run stops after script generation and prints the script to stdout. Each full run creates `output/run-YYYYMMDD-HHmmss/`.

---

## Pipeline stages (in order)

1. **topic-discovery** — LLM picks a topic from the active lane
2. **research-pack** — LLM builds a source-backed fact pack
3. **script-generation** — LLM writes the Short script (hook, beats, payoff, CTA)
4. **scene-plan** — LLM maps script beats to scene prompts + stock footage keywords
5. **voiceover** — Edge TTS renders audio + subtitle timing
6. **stock-footage** — Pexels search per scene, download clips
7. **assembly** — ffmpeg: crop/trim → concat → overlay voiceover + burned-in captions → `final.mp4`
8. **youtube-upload** / **tiktok-upload** — optional; requires `--upload` flag

GenSec review is not yet implemented as a stage — manual review is required before upload.

---

## GenSec policy (generation security)

These rules govern the whole system regardless of whether the automated review stage exists:

- **Topic policy:** Block auto-publish for medical/financial advice, elections, active conflicts, real-person defamation, celebrity likeness mimicry, minors in sensitive scenarios.
- **Claim safety:** No unsupported factual claims; all numbers must trace to the research pack; uncertainty must stay visible.
- **IP/likeness:** No imitating other creators' formats; no cloning non-owned voices; avoid trademark-heavy visual prompts.
- **Provider safety:** Moderate prompts and scripts; reject prompt injection; cap per-run spend; enforce retry limits.
- **Platform compliance:** Populate YouTube's synthetic media disclosure when required; persist upload metadata; log publish decisions.

Default `GenSecAssessment`: `disclosureRequired: true`, `riskLevel: "medium"`, `safeToAutoPublish: false`.

---

## Coding conventions

- TypeScript strict mode; ESM modules (`"type": "module"`)
- All imports use `.js` extensions (required for ESM)
- No `any` — extend domain types in `src/domain/models.ts` instead
- Never read `process.env` directly in pipeline stages — use the injected `AppConfig` from `loadConfig()`
- All LLM calls go through `LlmClient` in `src/providers/llm.ts` — never import Anthropic/Google SDKs in stage files
- All pipeline data shapes live in `src/domain/models.ts` — extend it first, then update stages
- Logging: `log(stage, msg)`, `logError(stage, msg)`, `logTiming(stage, startMs)` from `src/utils/logger.ts`
- `tsx` for execution; `tsc` for type-checking only
- Do not auto-publish without a passing `GenSecAssessment`

---

## Roadmap (current: Phase 1 → Phase 2)

- Phase 0 (foundation) ✅ — channel thesis, lane definitions, GenSec policy, provider shortlist
- Phase 1 (local engine) ✅ — full local pipeline producing `final.mp4` per run
- Phase 2 (n8n workflow) 🔄 — n8n workflow JSON exports exist; hosted integration in progress
- Phase 3 (assisted publishing) ⏳ — daily batch generation with operator approval
- Phase 4 (guarded autopublish) ⏳ — low-risk lanes only, auto-publish with spend budgets
- Phase 5 (optimization) ⏳ — hook/style libraries, retention feedback loop
