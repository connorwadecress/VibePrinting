# Vibe Printing — CLAUDE.md

This file is the authoritative context document for any AI assistant working in this repo.

---

## What this project is

**Vibe Printing** is a white-label automation pipeline that generates, assembles, and publishes AI-native short-form videos (YouTube Shorts, TikTok). It supports multiple brands running on the same engine — each brand gets its own folder under `brands/` with channel config, credentials, and branding assets. Anyone can set up their own brand folder and start publishing under their own identity.

The pipeline takes a content lane, uses an LLM to generate a topic + research + script, synthesizes voiceover audio, fetches stock footage, assembles a final video with burned-in captions, and optionally uploads to YouTube and TikTok.

---

## Quick start

1. `npm install` (runs for both root workspace and `web/` via npm workspaces)
2. Copy `.env.example` → `.env` and fill in engine API keys (LLM, Pexels)
3. Set up a brand: `cp -r brands/_template brands/my-brand`, rename `channel.example.json` → `channel.json`, fill in values, then create `.env`
4. `.\generate.ps1 -Brand my-brand -DryRun` — generates a script (no video, just LLM calls)
5. `.\generate.ps1 -Brand my-brand` — full pipeline, outputs `final.mp4`
6. `.\generate.ps1 -Brand my-brand -Upload` — full pipeline + upload to configured platforms
7. `npm run web:dev` — start the admin UI on http://localhost:3000 (brand editor, manual triggers, scheduler, upload history)

Legacy mode (no `--brand` flag) still works — falls back to root `channel.json` if present.

`brands/<id>/channel.json` is committed to the repo and edited in-place via the admin UI. It contains no secrets. `brands/<id>/.env` stays gitignored (OAuth tokens live there).

---

## Tech stack

| Layer | Tool |
|---|---|
| Language | TypeScript 5.9 (ESM, strict mode) |
| Runtime | Node.js via `tsx` |
| LLM | Claude (default) or Gemini — switchable via `LLM_PROVIDER` env var |
| TTS | `@andresaya/edge-tts` (Microsoft Edge TTS, free) |
| Stock footage | Pexels API (free) |
| Video assembly | FFmpeg via `fluent-ffmpeg` + `@ffmpeg-installer/ffmpeg` |
| Upload | YouTube (`googleapis` OAuth2) + TikTok Content Posting API |

---

## Architecture

Clean architecture with SOLID principles. No channel identity or provider implementation details leak into pipeline stages.

- **Interfaces** (`src/domain/interfaces/`) — contracts for all providers (`LlmClient`, `TtsProvider`, `FootageProvider`, `VideoAssembler`, `Uploader`) and the `PipelineStage` + `StageContext` types
- **Providers** (`src/providers/`) — concrete implementations behind interfaces, swappable without touching stages
- **Stages** (`src/pipeline/stages/`) — each implements `PipelineStage` with `execute(state, context)`, composable and reorderable
- **Brand folders** (`brands/<id>/`) — each brand has its own channel profile, credentials, and branding assets, fully isolated from other brands
- **Channel profile** (`brands/<id>/channel.json`) — all channel identity externalized: name, thesis, content lanes, branding, TTS voice (never in source)
- **Video specs** (`src/domain/video-specs.ts`) — resolution, codec, caption styling as data (not hardcoded in FFmpeg calls)
- **Brand resolver** (`src/utils/brand-resolver.ts`) — resolves `--brand=<id>` to file paths, loads brand-specific `.env` overlay
- **Composition root** (`src/generate.ts`) — wires providers → stages → runner; the only file that knows about concrete classes

### How to extend

| To add... | Do this |
|---|---|
| New LLM provider | Implement `LlmClient` in `src/providers/llm/`, add to factory in `index.ts` |
| New TTS engine | Implement `TtsProvider` in `src/providers/tts/`, wire in `generate.ts` |
| New footage source | Implement `FootageProvider` in `src/providers/footage/`, wire in `generate.ts` |
| New upload platform | Implement `Uploader` in `src/providers/upload/`, add to uploaders array in `generate.ts` |
| New video format | Add `VideoSpec` preset in `src/domain/video-specs.ts`, pass to assembler in `generate.ts` |
| New brand/channel | Copy `brands/_template/` to `brands/<id>/`, edit `channel.json` and `.env` |
| New pipeline stage | Implement `PipelineStage`, add to preset in `src/pipeline/presets/` |

---

## Repo layout

```
.env                                 — engine API keys (gitignored)
.env.example                         — template for root .env
channel.example.json                 — quick-start channel template
generate.ps1                         — PowerShell wrapper: -Brand, -Lane, -DryRun, -Upload
run-loop.ps1                         — auto-generate on interval: -Brand, -IntervalMinutes, -RunsMax
retry-upload.ps1                     — re-upload a previous run: -Brand, -Platform, -Run, -All
Get-YouTubeToken.ps1                 — one-time OAuth2 flow for YouTube refresh token
Get-TikTokToken.ps1                  — one-time OAuth2 flow for TikTok tokens

brands/                              — per-brand configuration and assets
  README.md                          — brand system overview
  _template/                         — scaffolding for new brands
    channel.example.json             — channel profile template
    .env.example                     — brand credential template
    README.md                        — step-by-step setup guide
  signal-drop/                       — Signal Drop brand (the original)
    channel.json                     — channel profile (committed; no secrets)
    .env                             — YouTube/TikTok credentials (gitignored)
    topic-history.json               — runtime dedup log (gitignored)
    branding/                        — brand-guide.md, logo.png, banner.png
    site/                            — signaldrop.space Vercel website
    CLAUDE.md                        — AI agent context for this brand
    README.md                        — brand documentation

web/                                 — admin UI (Next.js 15 App Router, workspace child)
  app/                               — pages + route handlers
  lib/                               — brand-io, job-manager, scheduler, deletion-worker
  components/                        — BrandForm, ContentLanesEditor, etc.
  boot.ts                            — starts scheduler + deletion worker at init
  instrumentation.ts                 — Next init hook
  middleware.ts                      — auth gate
  package.json                       — workspace child manifest
  tsconfig.json                      — extends root with Next JSX + @pipeline alias

data/                                — runtime state (gitignored, volume-mounted in Docker)
  deletion-queue.json                — pending cleanup entries
  jobs.json                          — job history snapshot
  schedules.json                     — per-brand cron schedules

logs/                                — runtime logs (gitignored, volume-mounted in Docker)
  upload-log.jsonl                   — one JSON line per upload attempt

docker/                              — container build
  Dockerfile                         — multi-stage, node:20 + ffmpeg
docker-compose.yml                   — snippet to merge into Hostinger n8n compose

src/                                 — engine code (brand-agnostic)
  config.ts                          — env loading → AppConfig
  generate.ts                        — composition root (wires providers → stages → runner)
  index.ts                           — bootstrap info (npm run plan)
  retry-upload.ts                    — re-upload previous runs to a platform

  domain/
    models.ts                        — all shared TypeScript types
    channel-profile.ts               — ChannelProfile interface + loadProfile() from JSON
    video-specs.ts                   — VideoSpec interface + SHORTS_PORTRAIT, LANDSCAPE_HD presets
    interfaces/
      llm-client.ts                  — LlmClient
      tts-provider.ts                — TtsProvider
      footage-provider.ts            — FootageProvider
      video-assembler.ts             — VideoAssembler
      uploader.ts                    — Uploader, UploadMetadata, UploadResult
      pipeline-stage.ts              — PipelineStage, StageContext
      index.ts                       — barrel export

  providers/
    llm/
      claude.ts                      — ClaudeClient (Anthropic SDK)
      gemini.ts                      — GeminiClient (Google GenAI SDK)
      index.ts                       — createLlmClient() factory
    tts/
      edge-tts.ts                    — EdgeTtsProvider
    footage/
      pexels.ts                      — PexelsProvider
    video/
      ffmpeg-assembler.ts            — FfmpegAssembler (reads VideoSpec, no hardcoded values)
    upload/
      youtube.ts                     — YouTubeUploader (Google APIs OAuth2)
      tiktok.ts                      — TikTokUploader (Content Posting API, chunked upload)

  pipeline/
    runner.ts                        — generic runPipeline(stages[], context, state)
    presets/
      shorts-pipeline.ts             — buildShortsPipeline({ dryRun?, upload? })
    stages/
      topic-discovery.ts             — LLM generates a topic from the active lane
      research-pack.ts               — LLM builds source-backed fact pack
      script-generation.ts           — LLM writes Short script (hook, beats, payoff, CTA)
      scene-plan.ts                  — LLM maps beats to visual prompts + stock keywords
      voiceover.ts                   — TTS synthesizes narration audio + subtitle timing
      stock-footage.ts               — fetches clips from footage provider per scene
      assembly.ts                    — assembles final video via VideoAssembler
      upload.ts                      — uploads to all configured Uploaders in parallel

  utils/
    brand-resolver.ts                — resolveBrand(), loadBrandEnv(), listBrands()
    fs-helpers.ts                    — ensureDir, createRunDir, downloadFile
    logger.ts                        — log, logError, logTiming

  publish/                           — standalone helpers (legacy, not used by pipeline)
    tiktok.ts                        — TikTok publish logic (pre-refactor reference)
    tiktok-auth.ts                   — one-time OAuth token helper

  n8n/                               — n8n workflow management (legacy, not used by pipeline)
    api.ts                           — N8nClient HTTP wrapper
    scope.ts                         — workflow scope management
    workflows.ts                     — workflow definitions
  n8n-cli.ts                         — CLI for n8n operations (legacy)
  n8n-export.ts                      — export workflows to JSON (legacy)

docs/                                — architecture.md, editorial-plan.md, roadmap.md, n8n-workflow-spec.md
```

---

## Running the pipeline

### npm scripts

| Script | Command |
|---|---|
| `npm run generate` | `tsx src/generate.ts` — main pipeline entry point |
| `npm run plan` | `tsx src/index.ts` — print channel profile and configured services |
| `npm run check` | `tsc -p tsconfig.json` — type-check only |
| `npm run n8n` | `tsx src/n8n-cli.ts` — n8n workflow CLI |
| `npm run export:workflows` | `tsx src/n8n-export.ts` — export workflow JSON |

### CLI arguments (generate.ts)

| Flag | Effect |
|---|---|
| `--brand=<id>` | Select a brand folder from `brands/<id>/` |
| `--lane=<id>` | Run a specific content lane (must match an id in channel.json) |
| `--dry-run` | Stop after script generation — no TTS, footage, video, or upload |
| `--upload` | Upload final video to all configured platforms |

### PowerShell wrappers

```powershell
.\generate.ps1 -Brand signal-drop -DryRun              # Script only
.\generate.ps1 -Brand signal-drop                       # Full pipeline
.\generate.ps1 -Brand signal-drop -Lane history-flash   # Specific lane
.\generate.ps1 -Brand signal-drop -Upload               # Full pipeline + upload
.\run-loop.ps1 -Brand signal-drop                       # Auto-generate + upload every 20 min
.\run-loop.ps1 -Brand signal-drop -IntervalMinutes 30 -RunsMax 5
.\retry-upload.ps1 -Brand signal-drop -Platform tiktok   # Re-upload latest run
```

Each run creates `output/run-YYYYMMDD-HHmmss/` containing `script.json`, clips, and `final.mp4`.

---

## Multi-brand system

The engine supports multiple brands running on the same codebase. Each brand has its own folder under `brands/` containing channel config, credentials, and branding assets.

### Brand folder structure

```
brands/<brand-id>/
  channel.json          — channel profile (gitignored)
  .env                  — platform credentials (gitignored)
  branding/             — visual assets and brand guide (committed)
  site/                 — optional website files (committed)
  CLAUDE.md             — AI agent context for this brand
  README.md             — brand documentation
```

### Brand selection priority

1. `--brand=<id>` CLI flag (highest priority)
2. `BRAND=<id>` env var (for automation/scheduled tasks)
3. `CHANNEL_PROFILE_PATH=<path>` env var (legacy explicit path)
4. Root `channel.json` (backward compatible fallback)

### Credential layering

- **Root `.env`** — engine-level keys (LLM, stock footage) shared by all brands
- **`brands/<id>/.env`** — brand-specific keys (YouTube, TikTok) loaded second, overrides root

### Creating a new brand

See `brands/_template/README.md` for step-by-step instructions. In brief:
```bash
cp -r brands/_template brands/my-brand
# Edit channel.json, .env, add branding assets
.\generate.ps1 -Brand my-brand -DryRun
```

---

## Channel configuration (channel.json)

All channel identity lives in `brands/<id>/channel.json` (gitignored). Copy from `brands/_template/channel.example.json`.

| Field | Purpose |
|---|---|
| `id` | Internal identifier (must match brand folder name) |
| `displayName` | Channel name (shown in logs) |
| `thesis` | What your channel is about — guides LLM topic generation |
| `contentLanes[]` | Content categories with descriptions, duration targets, and example hooks |
| `publishSlots[]` | Intended publish times (informational) |
| `branding.tags` | Tags applied to YouTube uploads |
| `branding.hashtags` | Hashtags applied to TikTok uploads |
| `branding.youTubeCategory` | YouTube category ID (e.g. "22" = People & Blogs) |
| `ttsVoice` | Edge TTS voice name (e.g. `en-US-GuyNeural`) |
| `ttsRate` | Speech rate modifier (e.g. `+10%`) |
| `genSecDefaults` | Default GenSec posture (disclosure, risk level, auto-publish) |

---

## Environment variables

### Root `.env` (engine-level, shared by all brands)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `LLM_PROVIDER` | No | `claude` | `claude` or `gemini` |
| `ANTHROPIC_API_KEY` | If claude | — | Claude API key |
| `CLAUDE_MODEL` | No | `claude-haiku-4-5-20251001` | Claude model ID |
| `GEMINI_API_KEY` | If gemini | — | Gemini API key |
| `GEMINI_MODEL` | No | `gemini-2.0-flash` | Gemini model ID |
| `PEXELS_API_KEY` | For video | — | Stock footage |
| `TTS_VOICE` | No | `en-US-GuyNeural` | Edge TTS voice (also in channel.json) |
| `TTS_RATE` | No | `+10%` | Speech rate (also in channel.json) |
| `OUTPUT_DIR` | No | `./output` | Where runs are saved |
| `DEFAULT_DAILY_TARGET` | No | `3` | Informational daily target |
| `BRAND` | No | — | Default brand (alternative to `--brand` CLI flag) |

### Brand `.env` (`brands/<id>/.env`, per-brand credentials)

| Variable | Required | Purpose |
|---|---|---|
| `YOUTUBE_CLIENT_ID` | For upload | YouTube OAuth |
| `YOUTUBE_CLIENT_SECRET` | For upload | YouTube OAuth |
| `YOUTUBE_REFRESH_TOKEN` | For upload | YouTube OAuth (via Get-YouTubeToken.ps1) |
| `YOUTUBE_CHANNEL_ID` | No | Informational |
| `TIKTOK_CLIENT_KEY` | For upload | TikTok API |
| `TIKTOK_CLIENT_SECRET` | For upload | TikTok API |
| `TIKTOK_ACCESS_TOKEN` | For upload | TikTok (or use refresh) |
| `TIKTOK_REFRESH_TOKEN` | For upload | TikTok (via Get-TikTokToken.ps1) |

---

## Pipeline stages (in order)

| # | Stage | Input | Output | Provider |
|---|---|---|---|---|
| 1 | **topic-discovery** | lane from channel.json | `TopicCandidate` | LLM |
| 2 | **research-pack** | topic | `ResearchPack` (claims + sources) | LLM |
| 3 | **script-generation** | topic + research + lane | `ShortScript` (hook, beats, payoff, CTA) | LLM |
| 4 | **scene-plan** | script | `ScenePlanWithKeywords[]` (3 retries) | LLM |
| 5 | **voiceover** | script narration text | `VoiceoverResult` (audio + subtitles) | TTS |
| 6 | **stock-footage** | scene keywords | `StockClip[]` (downloaded to clips/) | Footage |
| 7 | **assembly** | scenes + clips + voiceover | `final.mp4` | VideoAssembler |
| 8 | **upload** | video + branding metadata | `UploadResult[]` | Uploaders (parallel) |

Stages 4-8 are skipped in `--dry-run` mode. Stage 8 is skipped without `--upload`.

All stages read/write a shared `PipelineState` accumulator and get providers from `StageContext`.

---

## Key domain types (src/domain/models.ts)

| Type | Fields |
|---|---|
| `ContentLane` | id, description, exampleHooks, targetDurationSeconds |
| `TopicCandidate` | laneId, seedQuestion, titleAngle, noveltyScore, riskLevel |
| `ResearchPack` | topic, summary, claims[] (each with confidence + sourceLabels) |
| `ShortScript` | hook, beats[] (narration + visualIntent), payoff, callToAction, totalDurationSeconds, publishMeta? |
| `PublishMeta` | youtubeTitle, youtubeDescription, topicTags, topicHashtags |
| `ScenePlanWithKeywords` | sceneIndex, prompt, captions, seconds, searchKeywords |
| `VoiceoverResult` | audioPath, durationSeconds, subtitles[] |
| `StockClip` | id, url, width, height, duration, localPath, searchQuery |
| `GenSecAssessment` | blockedReasons, disclosureRequired, riskLevel, safeToAutoPublish |
| `PipelineState` | mutable accumulator: lane?, topic?, research?, script?, scenes?, voiceover?, clips?, outputVideoPath?, uploadResults? |

---

## GenSec policy (generation security)

These rules govern the system regardless of whether the automated review stage exists:

- **Topic policy:** Block auto-publish for medical/financial advice, elections, active conflicts, real-person defamation, celebrity likeness mimicry, minors in sensitive scenarios.
- **Claim safety:** No unsupported factual claims; all numbers must trace to the research pack; uncertainty must stay visible.
- **IP/likeness:** No imitating other creators' formats; no cloning non-owned voices; avoid trademark-heavy visual prompts.
- **Provider safety:** Moderate prompts and scripts; reject prompt injection; cap per-run spend; enforce retry limits.
- **Platform compliance:** Populate YouTube's synthetic media disclosure when required; persist upload metadata; log publish decisions.

Default posture (configurable in channel.json): `disclosureRequired: true`, `riskLevel: "medium"`, `safeToAutoPublish: false`.

GenSec review is not yet implemented as a pipeline stage — manual review is required before upload.

---

## Coding conventions

- TypeScript strict mode; ESM modules (`"type": "module"`)
- All imports use `.js` extensions (required for ESM/NodeNext)
- No `any` — extend domain types in `src/domain/models.ts`
- Pipeline stages get providers from `StageContext` — never import concrete providers in stage files
- All pipeline data shapes live in `src/domain/models.ts` — extend it first, then update stages
- Channel identity lives in `brands/<id>/channel.json` — never hardcode channel names, branding, or content lanes in source
- Brand-specific files (credentials, config, assets) go in `brands/<id>/` — never in the root or engine code
- Video format (resolution, codec, caption style) lives in `VideoSpec` — never hardcode in assembler
- New provider implementations go behind their interface — add to `src/providers/<category>/`
- Logging: `log(stage, msg)`, `logError(stage, msg)`, `logTiming(stage, startMs)` from `src/utils/logger.ts`
- `tsx` for execution; `tsc` for type-checking only (output goes to `dist/` but is not used at runtime)
- Do not auto-publish without a passing `GenSecAssessment`

---

## Roadmap

- Phase 0 (foundation) ✅ — channel thesis, lane definitions, GenSec policy, provider shortlist
- Phase 1 (local engine) ✅ — full local pipeline producing `final.mp4` per run
- Phase 1.5 (SOLID refactor) ✅ — clean architecture, provider interfaces, composable pipeline, white-label channel config
- Phase 1.6 (multi-brand) ✅ — brand folder system, `--brand` CLI flag, credential layering, brand-agnostic engine
- Phase 2 (n8n workflow) 🔄 — n8n workflow JSON exports exist; hosted integration in progress
- Phase 3 (assisted publishing) ⏳ — daily batch generation with operator approval
- Phase 4 (guarded autopublish) ⏳ — low-risk lanes only, auto-publish with spend budgets
- Phase 5 (optimization) ⏳ — hook/style libraries, retention feedback loop
