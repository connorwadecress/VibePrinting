# Vibe Printing — Getting Started

Welcome. This repo is an automated short-form video factory: you pick a topic
lane, and it generates a script, narrates it, finds footage, assembles a
vertical video with burned-in captions, and (optionally) uploads to
YouTube/TikTok.

You do **not** need to understand the whole codebase to use it. Follow this
document top to bottom.

> **Note:** `CLAUDE.md` is the deep architecture reference, but its *setup*
> section is out of date — it tells you to put API keys in the root `.env`.
> That's no longer how it works. Trust **this** document for setup.

---

## 1. What you need installed

| Tool | Why | Check |
|---|---|---|
| Node.js 20+ (24 recommended) | Runs everything | `node --version` |
| Git | Clone the repo | `git --version` |
| PowerShell | The CLI wrappers are `.ps1` scripts | Built into Windows |

FFmpeg is **not** a separate install — it ships as an npm dependency.

## 2. What you need to sign up for

Two free-tier accounts get you a working video with no upload:

| Service | Purpose | Cost |
|---|---|---|
| [Anthropic Console](https://console.anthropic.com/) | Writes the topic, research, and script | Pay-as-you-go, ~cents per video |
| [Pexels API](https://www.pexels.com/api/) | Stock footage | Free |

YouTube and TikTok credentials are only needed if you want to actually
publish. Skip them for now.

## 3. Setup

```bash
git clone https://github.com/connorwadecress/VibePrinting.git
cd VibePrinting
npm install
```

Create the root `.env` — this file **only** holds who can log into the admin UI:

```bash
cp .env.example .env
```

Then edit `.env` and set your own login:

```
VP_USER_1_ID=yourname
VP_USER_1_TOKEN=pick-any-long-random-string
VP_USER_1_BRANDS=my-brand
```

`VP_USER_1_TOKEN` is your password for the admin UI. `VP_USER_1_BRANDS` is the
list of brands you're allowed to see — it must match your brand folder name in
the next step.

Now create your own brand:

```bash
cp -r brands/_template brands/my-brand
cp brands/my-brand/channel.example.json brands/my-brand/channel.json
```

Open `brands/my-brand/channel.json` and set at minimum:

- `id` — must be exactly `my-brand` (match the folder name)
- `displayName` — whatever you want to call the channel
- `thesis` — one or two sentences on what the channel is about. This steers
  every topic the AI generates, so make it specific.
- `contentLanes[]` — the categories it draws topics from

## 4. Start the admin UI and add your API keys

```bash
npm run web:dev
```

Open http://localhost:3000, log in with the ID and token you set in `.env`.

Go to your brand's editor and find the credentials panel. Enter your
`ANTHROPIC_API_KEY` and `PEXELS_API_KEY` there. **API keys go in the UI, not in
the root `.env`** — the UI writes them to `brands/my-brand/.env`, which is
gitignored and never leaves your machine.

## 5. Your first run

Start with a dry run. This calls the AI to produce a topic, research, and
script, then stops — no video rendering, so it's fast and cheap:

```powershell
.\generate.ps1 -Brand my-brand -DryRun
```

Look in `output/run-<timestamp>/script.json` to see what it wrote. If the
script reads well, do a full run:

```powershell
.\generate.ps1 -Brand my-brand
```

That produces `output/run-<timestamp>/final.mp4`. First full run takes a few
minutes — most of it is downloading footage and rendering.

You can also trigger runs from the UI's Runs page and watch the logs stream
live, which is easier to debug than the terminal.

**Do not use `-Upload` yet.** It publishes to real accounts. Get comfortable
with the output first.

---

## How it works

The pipeline is eight stages. Each one reads what the previous stages produced
and adds to it:

| # | Stage | What it does |
|---|---|---|
| 1 | topic-discovery | Picks a topic from your content lane, avoiding past topics |
| 2 | research-pack | Gathers claims with sources |
| 3 | script-generation | Writes hook, beats, payoff, call-to-action |
| 4 | scene-plan | Maps script beats to visual ideas + footage search terms |
| 5 | voiceover | Synthesizes narration and subtitle timings |
| 6 | stock-footage | Downloads a clip per scene from Pexels |
| 7 | assembly | Renders the final vertical video with burned-in captions |
| 8 | upload | Publishes to YouTube/TikTok (only with `-Upload`) |

`-DryRun` stops after stage 3. Without `-Upload`, stage 8 is skipped.

Every log line is tagged with its stage — `[14:22:07] [scene-plan] ...` — so
when something fails you know exactly where.

### The shape of the codebase

- `src/pipeline/stages/` — the eight stages above, one file each
- `src/providers/` — swappable implementations (which AI, which TTS, which
  footage source, which upload target)
- `src/domain/` — the shared data types everything passes around
- `brands/<id>/` — your channel identity and credentials; **no brand-specific
  anything belongs in `src/`**
- `web/` — the admin UI. It doesn't import the pipeline; it spawns it as a
  child process and tails the output

The core design rule: the engine knows nothing about any specific channel.
Everything identity-shaped lives in `brands/<id>/channel.json`.

## Things that will surprise you

- **Active runs don't survive a restart.** If you stop the web server
  mid-render, that job is marked failed. Start a fresh one.
- **The scheduler doesn't catch up.** If the machine was asleep through a
  scheduled slot, that slot is simply skipped.
- **Run folders are auto-deleted 30 minutes after a successful upload.** Copy
  anything you want to keep.
- **Login sessions reset when the server restarts.** Just log in again.
- **`scene-plan` is the only stage that retries** (3 attempts). Everything else
  fails on first error.

When something breaks, `CLAUDE.md` has a debugging guide with a symptom →
cause → fix table. That part of the doc is accurate and genuinely useful.

## Ground rules

- Never commit a `.env` file, and never put a real API key anywhere except the
  admin UI.
- Don't run with `-Upload` against accounts that aren't yours.
- `brands/signal-drop/` is a live brand. Leave it alone — work in your own
  brand folder.
</content>
</invoke>
