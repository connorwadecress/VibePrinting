# Signal Drop

Signal Drop is a faceless, autonomous content brand. No host. No face. Just the signal -- whatever's worth dropping.

## Brand Identity

- **Channel name**: SignalDrop
- **Thesis**: Mixed content covering tech, culture, ideas, and everything in between
- **Voice**: Confident, concise, slightly mysterious, editorial
- **Tagline**: "Tuning in to everything."

## Accounts

| Platform | Handle |
|---|---|
| YouTube | @signaldropyt |
| TikTok | @signaldrop |

## Running

```powershell
# Generate a script (dry run)
.\generate.ps1 -Brand signal-drop -DryRun

# Full pipeline
.\generate.ps1 -Brand signal-drop

# Full pipeline + upload
.\generate.ps1 -Brand signal-drop -Upload

# Specific content lane
.\generate.ps1 -Brand signal-drop -Lane history-flash -DryRun
```

## Folder Contents

| File/Folder | Description |
|---|---|
| `channel.json` | Channel profile -- content lanes, branding, TTS config (gitignored) |
| `.env` | YouTube and TikTok OAuth credentials (gitignored) |
| `branding/` | Brand guide, logo, and banner assets |
| `site/` | signaldrop.space Vercel website |
| `dns-txt-record.txt` | TikTok domain verification DNS record |

## Setup

1. Ensure `channel.json` exists (copy from the committed backup or recreate from the template)
2. Ensure `.env` has valid YouTube/TikTok OAuth tokens
3. Run `.\generate.ps1 -Brand signal-drop -DryRun` to verify
