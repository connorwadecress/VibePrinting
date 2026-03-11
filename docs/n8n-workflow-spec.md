# n8n Workflow Spec

## Key assumption

Your `n8n` instance is hosted.

That means this repo should not be treated as code that `n8n` can run locally on demand unless we deploy it somewhere reachable. The clean design is:

- `n8n` handles orchestration, retries, approvals, and publishing
- this repo becomes a small HTTP worker service for prompts, scoring, schemas, and GenSec decisions

## MVP workflow

### Workflow A: daily batch

Purpose:

- generate a queue of candidate Shorts
- prepare assets
- hold for review or auto-publish if allowed

Recommended nodes:

1. `Schedule Trigger`
2. `Set` channel config
3. `HTTP Request` to worker: `/topics/generate`
4. `Split Out` or `Loop Over Items`
5. `HTTP Request` to worker: `/research/build`
6. `OpenAI` text operation or worker: `/scripts/generate`
7. `HTTP Request` to worker: `/gensec/text-check`
8. `IF` blocked?
9. `OpenAI` audio or speech generation
10. `OpenAI` video generation or external provider call
11. `HTTP Request` to worker: `/assembly/manifest`
12. media assembly step
13. `HTTP Request` to worker: `/gensec/final-check`
14. `IF` auto-publish allowed?
15. `YouTube` upload video
16. notification or review queue

## Suggested worker endpoints

### `POST /topics/generate`

Input:

- theme id
- lane ids
- recent topic history
- daily target

Output:

- ranked topic candidates

### `POST /research/build`

Input:

- selected topic

Output:

- research pack

### `POST /scripts/generate`

Input:

- research pack
- duration target
- channel voice

Output:

- structured short script
- title options
- description draft

### `POST /gensec/text-check`

Input:

- research pack
- script
- metadata draft

Output:

- risk level
- blocked reasons
- disclosure required
- auto-publish eligibility

### `POST /assembly/manifest`

Input:

- script
- narration timing
- scene plan
- rendered asset URLs

Output:

- final render manifest

### `POST /gensec/final-check`

Input:

- manifest
- final metadata
- provider outputs

Output:

- final publish decision

## Hosted n8n constraints

### Avoid local assumptions

Do not assume:

- local disk paths are shared with `n8n`
- `ffmpeg` is installed on the hosted instance
- custom binaries can be dropped into the hosted runtime

### Prefer URL-based assets

Pass assets around as:

- signed URLs
- object storage keys
- provider file IDs

## Recommended storage pattern

- object storage bucket for intermediate assets
- lightweight database table for runs, scores, and approvals
- webhook callback or polling for long video renders

## Approval model

For MVP, do not auto-publish everything.

Use one review queue with these outcomes:

- approve and publish now
- schedule
- reject
- rerender visuals only
- rewrite script only

## Failure model

For each generated Short, persist:

- run id
- topic id
- provider ids
- cost estimate
- failure stage
- retry count

This keeps failures recoverable instead of forcing the whole batch to restart.

## Sequence recommendation

Build in this order:

1. worker endpoints for topic, script, and GenSec
2. one hosted `n8n` workflow that generates and holds a Short
3. YouTube upload path
4. analytics feedback workflow

## What MCP changes

If you expose `n8n` through MCP, I can create and revise the workflow directly instead of only describing it here.
