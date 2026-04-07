# Vibe Printing

White-label automation pipeline for generating, assembling, and publishing AI-native short-form videos (YouTube Shorts, TikTok).

## What this is

A controlled content factory -- not random AI slop at scale:

- Brand-agnostic engine with pluggable providers (LLM, TTS, footage, upload)
- Multi-brand support -- each brand gets its own folder with channel config, credentials, and assets
- Clean architecture with SOLID principles -- every technology and content type is decoupled and interchangeable
- Generation security (GenSec) governance before publish
- Full pipeline: topic discovery -> research -> script -> voiceover -> stock footage -> video assembly -> upload

## Quick start

```bash
npm install
```

**Set up a brand:**
```bash
cp -r brands/_template brands/my-brand
# Edit brands/my-brand/channel.json (channel identity, content lanes)
# Edit brands/my-brand/.env (YouTube/TikTok credentials)
```

**Set up engine keys:**
```bash
cp .env.example .env
# Add ANTHROPIC_API_KEY and PEXELS_API_KEY
```

**Run from CLI:**
```powershell
.\generate.ps1 -Brand my-brand -DryRun     # Script only (no video)
.\generate.ps1 -Brand my-brand              # Full pipeline -> final.mp4
.\generate.ps1 -Brand my-brand -Upload      # Full pipeline + upload
```

**Run from admin UI:**
```bash
# Set ADMIN_TOKEN in .env first (any string -- it's the operator login)
npm run web:dev    # http://localhost:3000
```
The UI spawns the pipeline as a child process, streams logs over SSE, manages a per-brand cron scheduler, and shows upload history.

## Repo structure

| Directory | Purpose |
|---|---|
| `brands/` | Per-brand config, credentials, and assets (see `brands/README.md`) |
| `src/` | Engine code -- pipeline stages, providers, domain types (brand-agnostic) |
| `web/` | Admin UI (Next.js) -- brand editor, manual triggers, scheduler, upload history (see `web/README.md`) |
| `docker/` | Container build + Hostinger compose snippet |
| `data/` | Runtime state (jobs, schedules, deletion queue) -- gitignored, volume-mounted |
| `logs/` | Upload log -- gitignored, volume-mounted |
| `docs/` | Architecture, editorial plan, roadmap |

See **`CLAUDE.md`** for the full repo layout, architecture details, web admin UI internals, runtime data shapes, debugging guide, and coding conventions. Start there when something breaks.
