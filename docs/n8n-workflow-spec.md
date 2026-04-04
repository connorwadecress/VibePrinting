# n8n Workflow Spec

## Decision

Use `n8n` as the primary orchestrator.

Do not treat hosted `n8n` as a shell for chaining code nodes together unless there is no native node or external API path available.

Recommended split:

- `n8n`: scheduling, fan-out, approvals, retries, credentials, provider calls, publishing, lightweight state
- repo-side worker: only for things `n8n` is bad at, mainly media assembly, prompt/schema versioning, and policy logic that becomes too large for workflow nodes

This is the cleaner design for your use case because the platform already gives us:

- `OpenAI` nodes for text, image, audio, and video operations
- `YouTube` node support for upload and update flows
- `Execute Sub-workflow` for composition
- `HTTP Request` for providers that do not have first-class nodes
- `Data Store` or external tables for lightweight run state

## What Should Stay Out Of n8n

Keep these outside hosted `n8n`:

- `ffmpeg` composition
- any local filesystem assumptions
- long-running custom binaries
- heavy prompt libraries and policy code that want normal source control and tests

If we need caption burn-in, clip concatenation, ducking, or final export normalization, that should run in a small external worker or automation, not inside hosted `n8n`.

## Recommended Workflow Tree

### Parent workflow: `Vibe Printing - Daily Batch`

Purpose:

- decide what to make today
- generate one or more Shorts
- hold for review
- publish only after explicit approval

Recommended shape:

1. `Schedule Trigger`
2. `Data Store` or external table lookup for recent topics, blocked angles, and prior runs
3. `Execute Sub-workflow`: `Topic Planner`
4. `Loop Over Items`
5. `Execute Sub-workflow`: `Research Pack`
6. `Execute Sub-workflow`: `Script Pack`
7. `OpenAI` moderation or classification check
8. `IF` blocked or review-required
9. `Execute Sub-workflow`: `Voiceover`
10. `Execute Sub-workflow`: `Visual Plan`
11. `Execute Sub-workflow`: `Video Render`
12. `HTTP Request` to assembly worker
13. `Review queue` notification
14. `IF` approved
15. `YouTube` upload
16. `Data Store` or external table update for run state and analytics keys

## Recommended Sub-workflows

### `Vibe Printing - Topic Planner`

Use:

- current workflow as the starter
- eventually upgrade to `OpenAI` structured output if we want live topic ideation instead of seeded lane logic

Output:

- `selectedCandidates`
- `backlogCandidates`
- novelty and risk hints

### `Vibe Printing - Research Pack`

This should be a real retrieval workflow, not a code-only placeholder.

Preferred implementation:

1. `HTTP Request` to a search or research provider
2. optional second retrieval source for corroboration
3. `OpenAI` structured summarization step
4. `Code` node only for light normalization or score merging
5. persist compact source-backed research pack

Minimum output:

- summary
- key claims
- source URLs
- confidence notes
- unresolved questions

### `Vibe Printing - Script Pack`

Use the `OpenAI` node for structured output.

Input:

- research pack
- lane voice
- duration target

Output:

- hook
- beats
- payoff
- title options
- description draft
- disclosure flag

Keep this step model-driven. This is one of the places where `n8n` native OpenAI support is actually valuable.

### `Vibe Printing - Voiceover`

Use the `OpenAI` audio operation for narration generation.

Output:

- audio file
- segment timing if available
- fallback transcript

Store binaries in external storage, not in workflow-local assumptions.

### `Vibe Printing - Visual Plan`

Input:

- approved script
- brand style guide
- target scene count

Output:

- `4-6` scene prompts
- caption text
- target seconds per scene

This can be an `OpenAI` structured output step.

### `Vibe Printing - Video Render`

Use the `OpenAI` video operation or another video provider through `HTTP Request`.

Recommended posture:

- short per-scene clips
- portrait-first prompts
- keep retries bounded
- persist provider IDs and URLs

### `Vibe Printing - Assembly`

This is where `n8n` should stop being clever.

Input:

- narration asset URL
- scene clip URLs
- caption plan
- music choice

Implementation:

- `HTTP Request` to a repo-side worker or automation that runs the real media assembly

Output:

- final `.mp4`
- final thumbnail or poster if needed
- caption file

### `Vibe Printing - Publish`

Use the `YouTube` node for upload and metadata updates once credentials exist.

Persist:

- upload ID
- title
- description
- disclosure choice
- publish time
- analytics lookup keys

## Storage Recommendation

Split storage by artifact type:

- metadata and run state: `n8n` `Data Store`, `Airtable`, `Notion`, `Google Sheets`, or a small database
- binaries: `Google Drive`, `S3`, `R2`, `Azure Blob`, or similar object storage

Do not use workflow memory alone as the source of truth for recoverable runs.

Persist at least:

- topic ID
- run ID
- research pack ID
- script version
- provider asset IDs
- approval status
- publish status
- error stage

## Credential Checklist

These are the first credentials worth adding in `n8n`:

1. `OpenAI`
2. `YouTube` or Google OAuth for YouTube upload
3. storage provider credential for binary assets
4. optional research provider credential if we use a dedicated search API
5. optional Slack, Discord, or email credential for review notifications

If you only add one credential first, add `OpenAI`. That unlocks the most real progress immediately.

## Build Order

This is the recommended next sequence:

1. wire a real `OpenAI` credential in `n8n`
2. replace the placeholder `Short Script Generator` with a native `OpenAI` workflow
3. add a native `Voiceover` workflow using `OpenAI` audio
4. add a `Visual Plan` plus `Video Render` workflow
5. choose binary storage
6. add one external assembly worker
7. add `YouTube` publish
8. keep review mandatory until the first clean shadow period

## Current Repo Posture

The workflows created so far prove:

- MCP can create and update workflows
- hosted `n8n` webhooks are reachable
- we can dry-run the pipeline shape end to end

They are not yet the final architecture.

The next iteration should move from placeholder code-node logic toward:

- native `OpenAI` nodes
- real retrieval
- real storage
- one real assembly handoff

That is the point where the pipeline becomes worth operationalizing instead of only testing.
