# Brands

This directory contains per-brand configuration, assets, and credentials for each channel running on the VibePrinting engine.

## How It Works

The VibePrinting engine is brand-agnostic. All channel identity, content strategy, and platform credentials live in brand folders here -- never in the engine source code (`src/`).

Each brand folder is a self-contained package:
```
brands/<brand-id>/
  channel.json          -- channel profile (name, thesis, lanes, branding)
  .env                  -- platform credentials (YouTube/TikTok OAuth)
  branding/             -- visual assets (logo, banner, brand guide)
  site/                 -- optional website/landing page
  README.md             -- brand documentation
  CLAUDE.md             -- AI agent context for this brand
```

## Selecting a Brand

```powershell
# CLI flag (recommended)
.\generate.ps1 -Brand signal-drop

# Environment variable (for automation/scheduled tasks)
$env:BRAND = "signal-drop"
.\generate.ps1

# Direct path (legacy, still works)
$env:CHANNEL_PROFILE_PATH = "brands/signal-drop/channel.json"
.\generate.ps1
```

## Credential Layering

Credentials are loaded in two layers:
1. **Root `.env`** -- engine-level keys (LLM, stock footage) shared by all brands
2. **`brands/<id>/.env`** -- brand-specific keys (YouTube, TikTok) that override root values

This means each brand can have its own YouTube channel and TikTok account while sharing the same LLM and footage API keys.

## Creating a New Brand

See `_template/README.md` for step-by-step instructions.

```bash
cp -r brands/_template brands/my-brand
# Edit channel.json, .env, add branding assets
.\generate.ps1 -Brand my-brand -DryRun
```

## Directory Conventions

| Folder | Description |
|---|---|
| `_template/` | Scaffolding for new brands (not a real brand) |
| `signal-drop/` | Signal Drop channel -- the original brand |

Brand folder names must be lowercase, hyphen-separated, and match the `id` field in `channel.json`.
