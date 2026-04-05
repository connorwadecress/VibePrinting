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

**Run:**
```powershell
.\generate.ps1 -Brand my-brand -DryRun     # Script only (no video)
.\generate.ps1 -Brand my-brand              # Full pipeline -> final.mp4
.\generate.ps1 -Brand my-brand -Upload      # Full pipeline + upload
```

## Repo structure

| Directory | Purpose |
|---|---|
| `brands/` | Per-brand config, credentials, and assets (see `brands/README.md`) |
| `src/` | Engine code -- pipeline stages, providers, domain types (brand-agnostic) |
| `docs/` | Architecture, editorial plan, roadmap |

See `CLAUDE.md` for the full repo layout, architecture details, coding conventions, and extension guide.
