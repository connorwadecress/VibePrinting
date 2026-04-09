# Signal Drop -- AI Agent Context

This folder contains all configuration, branding, and deployment files for the **Signal Drop** channel. Signal Drop is the original brand built on the VibePrinting engine.

## Important: This Is a Brand Folder, Not the Engine

- **Engine code** lives in `src/` at the repo root. Never modify engine code for brand-specific changes.
- **Brand identity** lives here. Channel name, content lanes, visual assets, and platform credentials are all in this folder.
- **Other brands** have their own folders under `brands/`. Each is independent.

## Key Files

| File | Purpose | Sensitive? |
|---|---|---|
| `channel.json` | Channel profile (lanes, branding, TTS settings) | **Committed to git** -- content strategy, no secrets. Edited via the admin UI. |
| `.env` | YouTube/TikTok OAuth tokens | Gitignored -- credentials |
| `topic-history.json` | Per-brand topic dedup log | Gitignored -- runtime state |
| `branding/brand-guide.md` | Visual identity, voice, tone | No |
| `branding/logo.png` | Channel logo | No |
| `branding/banner.png` | Channel banner | No |
| `site/` | signaldrop.space Vercel deployment | No |
| `dns-txt-record.txt` | TikTok domain verification | No |

## Content Lanes

Signal Drop's content lanes are defined in `channel.json`. Refer to that file for the current lane definitions, example hooks, and duration targets.

## When Working on Signal Drop

- Use `--brand=signal-drop` with all pipeline commands
- Brand-specific credentials override root `.env` values
- If OAuth tokens expire, re-run `Get-YouTubeToken.ps1` or `Get-TikTokToken.ps1` and update `.env` in this folder
- Visual assets in `branding/` are committed to git and shared across the team
