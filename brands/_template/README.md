# Brand Template

Use this folder as a starting point for setting up a new brand on the VibePrinting engine.

## Quick Setup

1. **Copy this folder** to `brands/<your-brand-id>/`:
   ```bash
   cp -r brands/_template brands/my-brand
   ```

2. **Rename and edit `channel.example.json`** to `channel.json`:
   ```bash
   mv brands/my-brand/channel.example.json brands/my-brand/channel.json
   ```
   Fill in your channel identity: name, thesis, content lanes, branding, TTS voice.

3. **Copy `.env.example`** to `.env` and add your platform credentials:
   ```bash
   cp brands/my-brand/.env.example brands/my-brand/.env
   ```
   Add YouTube OAuth tokens (via `Get-YouTubeToken.ps1`) and/or TikTok tokens (via `Get-TikTokToken.ps1`).

4. **Add your branding assets** to `brands/my-brand/branding/`:
   - `brand-guide.md` — voice, tone, visual identity
   - `logo.png` — channel logo
   - `banner.png` — channel banner

5. **Test your brand**:
   ```powershell
   .\generate.ps1 -Brand my-brand -DryRun
   ```

## What Goes in a Brand Folder

| File/Folder | Purpose | Committed to git? |
|---|---|---|
| `channel.json` | Channel identity, content lanes, branding config | No (gitignored) |
| `.env` | Platform credentials (YouTube, TikTok OAuth tokens) | No (gitignored) |
| `branding/` | Visual assets and brand guide | Yes |
| `site/` | Optional website/landing page files | Yes |
| `README.md` | Brand documentation | Yes |
| `CLAUDE.md` | AI agent context for this brand | Yes |

## What Stays in Root `.env`

Engine-level API keys shared across all brands:
- `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` (LLM provider)
- `PEXELS_API_KEY` (stock footage)
- `LLM_PROVIDER`, `OUTPUT_DIR`, etc.

These are loaded first; your brand `.env` overrides any matching keys.
