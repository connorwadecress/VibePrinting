# Docker deployment

The VibePrinting admin UI ships as a single container that runs the
Next.js server, the per-brand cron scheduler, and the deletion
worker in one Node process.

## Build locally

```bash
docker compose build vibeprinting
```

The build context is the repo root. `.dockerignore` keeps it small
(no `node_modules`, no `output/`, no `.git`).

## Run locally

```bash
# Set the admin token (single-operator auth)
export VP_ADMIN_TOKEN=$(openssl rand -base64 32)

# Engine credentials — same .env you use for local PowerShell runs
export ANTHROPIC_API_KEY=...
export PEXELS_API_KEY=...

docker compose up -d vibeprinting
docker compose logs -f vibeprinting
```

Open <http://127.0.0.1:3000>, log in with `VP_ADMIN_TOKEN`.

## Hostinger deployment

1. `scp -r .` the repo (or `git pull` on the box) into the same
   directory that hosts the existing n8n compose file.
2. Merge the `vibeprinting:` service block from `docker-compose.yml`
   into the n8n compose file (the network `n8n-net` is shared, so
   reverse-proxy routing "just works").
3. Add `VP_ADMIN_TOKEN`, `ANTHROPIC_API_KEY`, `PEXELS_API_KEY`, and
   any platform-specific keys to the host `.env`.
4. `docker compose build vibeprinting && docker compose up -d vibeprinting`.
5. Add a vhost on the existing reverse proxy:
   `vibeprinting.<your-domain>` → `vibeprinting:3000`.

## Volumes

| Host path | Container path | Purpose |
|---|---|---|
| `./brands` | `/app/brands` | Per-brand `channel.json`, branding assets, gitignored `.env` |
| `./output` | `/app/output` | Pipeline run dirs (auto-deleted by the worker after upload) |
| `./data` | `/app/data` | `deletion-queue.json`, `jobs.json`, `schedules.json` |
| `./logs` | `/app/logs` | `upload-log.jsonl` |

All four survive `docker compose down && up` because they live on
the host. Channel configs and topic history persist across rebuilds.

## Health check

```bash
curl http://127.0.0.1:3000/api/health
```

The endpoint is unauthenticated and returns 200 once Next has booted.
docker-compose's healthcheck polls it every 30 s.
