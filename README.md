# Vibe Printing

Automation-first pipeline for generating, reviewing, and publishing AI-native YouTube Shorts.

## What this repo is for

The goal is not "random AI slop at scale." The goal is a controlled content factory:

- one channel thesis
- repeatable short-form formats
- generation security and governance ("GenSec")
- automated rendering and upload
- analytics feedback that improves future topics

The initial target is `2-3` Shorts per day with a path from assisted publishing to full autopilot.

## Recommended stack

- `n8n` as the orchestrator and operator dashboard
- `TypeScript` worker code in this repo for prompts, policy, schemas, scoring, and adapters
- `OpenAI` for topic planning, script generation, moderation, voice, and optionally video
- `YouTube Data API` for upload, metadata, scheduling, and analytics pull
- `ffmpeg` or provider-native composition where post-processing is needed

## Repo layout

- [`docs/architecture.md`](C:\Users\ConnorCress\source\PersonalDev\VibePrinting\docs\architecture.md): system design and GenSec model
- [`docs/editorial-plan.md`](C:\Users\ConnorCress\source\PersonalDev\VibePrinting\docs\editorial-plan.md): channel strategy and content lanes
- [`docs/roadmap.md`](C:\Users\ConnorCress\source\PersonalDev\VibePrinting\docs\roadmap.md): phased delivery plan
- [`src/domain/models.ts`](C:\Users\ConnorCress\source\PersonalDev\VibePrinting\src\domain\models.ts): pipeline contracts
- [`src/pipeline/blueprint.ts`](C:\Users\ConnorCress\source\PersonalDev\VibePrinting\src\pipeline\blueprint.ts): initial blueprint and defaults

## Quick start

```bash
npm install
npm run plan
```

Copy `.env.example` to `.env` when you are ready to wire real providers.

## Current posture

This first pass is intentionally opinionated:

- recommend a narrow channel thesis before going broad
- require GenSec checks before publish
- start with assisted publishing
- graduate to auto-publish only after a clean shadow period

