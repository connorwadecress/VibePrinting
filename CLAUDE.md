# Vibe Printing — CLAUDE.md

This file is the authoritative context document for any AI assistant working in this repo.

---

## What this project is

**Vibe Printing** is a white-label automation pipeline that generates, assembles, and publishes AI-native short-form videos (YouTube Shorts, TikTok). It is not tied to any specific channel — channel identity, content lanes, and branding are fully user-configurable via `channel.json`. Anyone can clone this repo, plug in their credentials and brand config, and start publishing under their own identity.

The pipeline takes a content lane, uses an LLM to generate a topic + research + script, synthesizes voiceover audio, fetches stock footage, assembles a final video with burned-in captions, and optionally uploads to YouTube and TikTok.

---

## Quick start

1. `npm install`
2. Copy `.env.example` → `.env` and fill in API keys
3. Copy `channel.example.json` → `channel.json` and customize your channel identity
4. `.\generate.ps1 -DryRun` — generates a script (no video, just LLM calls)
5. `.\generate.ps1` — full pipeline, outputs `final.mp4`
6. `.\generate.ps1 -Upload` — full pipeline + upload to configured platforms

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
- **Channel profile** (`channel.json`) — all channel identity externalized: name, thesis, content lanes, branding, TTS voice (never in source)
- **Video specs** (`src/domain/video-specs.ts`) — resolution, codec, caption styling as data (not hardcoded in FFmpeg calls)
- **Composition root** (`src/generate.ts`) — wires providers → stages → runner; the only file that knows about concrete classes

### How to extend

| To add... | Do this |
|---|---|
| New LLM provider | Implement `LlmClient` in `src/providers/llm/`, add to factory in `index.ts` |
| New TTS engine | Implement `TtsProvider` in `src/providers/tts/`, wire in `generate.ts` |
| New footage source | Implement `FootageProvider` in `src/providers/footage/`, wire in `generate.ts` |
| New upload platform | Implement `Uploader` in `src/providers/upload/`, add to uploaders array in `generate.ts` |
| New video format | Add `VideoSpec` preset in `src/domain/video-specs.ts`, pass to assembler in `generate.ts` |
| New channel/theme | Edit `channel.json` — add lanes, change branding, swap TTS voice |
| New pipeline stage | Implement `PipelineStage`, add to preset in `src/pipeline/presets/` |

---

## Repo layout

```
channel.json                         — your channel identity (gitignored, user-created)
channel.example.json                 — template for channel.json
.env                                 — API keys and secrets (gitignored)
.env.example                         — template for .env
generate.ps1                         — PowerShell wrapper: -Lane, -DryRun, -Upload
run-loop.ps1                         — auto-generate on interval: -IntervalMinutes, -RunsMax
Get-YouTubeToken.ps1                 — one-time OAuth2 flow for YouTube refresh token
Get-TikTokToken.ps1                  — one-time OAuth2 flow for TikTok tokens

src/
  config.ts                          — env loading → AppConfig
  generate.ts                        — composition root (wires providers → stages → runner)
  index.ts                           — bootstrap info (npm run plan)

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

  n8n/                               — n8n workflow management (legacy, not used by pipeline)
    api.ts                           — N8nClient HTTP wrapper
    scope.ts                         — workflow scope management
    workflows.ts                     — workflow definitions
  n8n-cli.ts                         — CLI for n8n operations (npm run n8n)
  n8n-export.ts                      — export workflows to JSON (npm run export:workflows)

  publish/                           — standalone helpers (not used by pipeline)
    tiktok.ts                        — TikTok publish logic (pre-refactor, kept for reference)
    tiktok-auth.ts                   — one-time OAuth token helper

  utils/
    fs-helpers.ts                    — ensureDir, createRunDir, downloadFile
    logger.ts                        — log, logError, logTiming

docs/                                — architecture.md, editorial-plan.md, roadmap.md, n8n-workflow-spec.md
branding/                            — brand-guide.md, logo.png, banner.png
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
| `--lane=<id>` | Run a specific content lane (must match an id in channel.json) |
| `--dry-run` | Stop after script generation — no TTS, footage, video, or upload |
| `--upload` | Upload final video to all configured platforms |

### PowerShell wrappers

```powershell
.\generate.ps1                               # Full pipeline, random lane
.\generate.ps1 -Lane history-flash -DryRun   # Script only
.\generate.ps1 -Upload                       # Full pipeline + upload
.\run-loop.ps1                               # Auto-generate + upload every 20 min
.\run-loop.ps1 -IntervalMinutes 30 -RunsMax 5
```

Each run creates `output/run-YYYYMMDD-HHmmss/` containing `script.json`, clips, and `final.mp4`.

---

## Channel configuration (channel.json)

All channel identity lives in `channel.json` (gitignored). Copy `channel.example.json` to get started.

| Field | Purpose |
|---|---|
| `id` | Internal identifier |
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

Override the file path via `CHANNEL_PROFILE_PATH` env var.

---

## Environment variables (.env)

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
| `YOUTUBE_CLIENT_ID` | For upload | — | YouTube OAuth |
| `YOUTUBE_CLIENT_SECRET` | For upload | — | YouTube OAuth |
| `YOUTUBE_REFRESH_TOKEN` | For upload | — | YouTube OAuth (via Get-YouTubeToken.ps1) |
| `YOUTUBE_CHANNEL_ID` | No | — | Informational |
| `TIKTOK_CLIENT_KEY` | For upload | — | TikTok API |
| `TIKTOK_CLIENT_SECRET` | For upload | — | TikTok API |
| `TIKTOK_ACCESS_TOKEN` | For upload | — | TikTok (or use refresh) |
| `TIKTOK_REFRESH_TOKEN` | For upload | — | TikTok (via Get-TikTokToken.ps1) |
| `OUTPUT_DIR` | No | `./output` | Where runs are saved |
| `DEFAULT_DAILY_TARGET` | No | `3` | Informational daily target |
| `CHANNEL_PROFILE_PATH` | No | `./channel.json` | Override channel profile location |

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
| `ShortScript` | hook, beats[] (narration + visualIntent), payoff, callToAction, totalDurationSeconds |
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
- Channel identity lives in `channel.json` — never hardcode channel names, branding, or content lanes in source
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
- Phase 2 (n8n workflow) 🔄 — n8n workflow JSON exports exist; hosted integration in progress
- Phase 3 (assisted publishing) ⏳ — daily batch generation with operator approval
- Phase 4 (guarded autopublish) ⏳ — low-risk lanes only, auto-publish with spend budgets
- Phase 5 (optimization) ⏳ — hook/style libraries, retention feedback loop
