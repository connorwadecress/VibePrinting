# Vibe Printing — Admin UI

Next.js 15 (App Router) admin panel for the Vibe Printing engine. Workspace child of the root `package.json`.

> The full architecture, API surface, runtime data shapes, and debugging guide live in the root **`CLAUDE.md`** under "Web admin UI", "Runtime data files", and "Debugging guide". This README is just a navigation pointer.

## What it does

- Edit brand `channel.json` files in-place (Zod-validated)
- View per-brand topic history
- Manually trigger pipeline runs (lane + dry-run + platform picker)
- Live-stream run logs over SSE
- Cron-style scheduler per brand (node-cron, hot-reloaded)
- Upload history (reads `logs/upload-log.jsonl` in reverse)
- Background deletion worker that purges old run dirs after upload

## Run locally

```bash
# From repo root (workspaces share node_modules)
npm install
npm run web:dev    # http://localhost:3000
```

You **must** set `ADMIN_TOKEN` in the environment or the UI is unreachable. Add it to root `.env` for local dev:
```
ADMIN_TOKEN=dev-token-pick-anything
```

## Key files

| File | Role |
|---|---|
| `instrumentation.ts` | Next init hook → calls `boot.ts` once per process |
| `boot.ts` | Starts deletion worker + scheduler (idempotent) |
| `middleware.ts` | Token auth gate + session cookie (`vp_admin`) |
| `lib/paths.ts` | Resolves all on-disk paths from `VP_*` env vars |
| `lib/brand-io.ts` | Read/write `brands/<id>/channel.json` |
| `lib/job-manager.ts` | Spawns `npx tsx src/generate.ts ...` per run |
| `lib/job-store.ts` | In-memory + `data/jobs.json` snapshot, per-job event bus |
| `lib/scheduler.ts` | node-cron, watches `data/schedules.json` |
| `lib/schedule-fs.ts` | Atomic read/write of schedules file |
| `lib/deletion-worker.ts` | 60s tick, sweeps `data/deletion-queue.json` |
| `lib/upload-log-reader.ts` | Reverse tail-reader for `logs/upload-log.jsonl` |
| `app/(app)/runs/[jobId]/` | Live SSE log view (`RunStreamView`) |
| `app/api/runs/stream/route.ts` | SSE endpoint (`status` / `log` / `end` events + 15s heartbeat) |

## Important constraints

- **The UI does not import the pipeline.** It spawns `tsx src/generate.ts` as a child process. This keeps the engine and UI decoupled.
- **One active job per brand.** `startRun()` rejects concurrent runs for the same brand.
- **Active runs do not survive container restart.** Any `running`/`queued` job loaded from `jobs.json` on boot is flipped to `failed` with error `"container restarted"`.
- **Sessions are in-memory.** Operators must re-login after every redeploy.
- **Scheduler does not catch up.** Missed cron slots during downtime are skipped.
- **Path overrides:** all on-disk locations come from `VP_*` env vars (`VP_DATA_DIR`, `VP_LOGS_DIR`, `VP_BRANDS_DIR`, `VP_OUTPUT_DIR`). Defaults are CWD-relative; the Dockerfile pins them to `/app/...`.

See the root `CLAUDE.md` "Debugging guide" for failure modes and where to look first.
