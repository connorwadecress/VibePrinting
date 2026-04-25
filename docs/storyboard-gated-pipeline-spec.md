# Storyboard-Gated Pipeline Spec

## Goal

Refactor Vibe Printing from a mostly automated shortform generator into a **human-in-the-loop editorial pipeline** with explicit review gates, storyboard artifacts, and continuity assets.

This spec is the implementation contract for `feat/storyboard-gated-pipeline`.

## Why

Current flow:

- topic discovery
- research pack
- script generation
- scene plan
- voiceover
- stock footage
- assembly
- caption overlay
- optional upload

That flow is useful for batch generation, but it is missing the most valuable creative controls:

- no script approval gate
- no storyboard deck artifact
- no structured storyboard revision pass
- no final publish approval requirement
- no first-class continuity asset model

The result is efficient production with weak editorial control.

## Target operating model

The pipeline should behave like an old-school creative department with modern tooling:

1. Generate a script draft
2. Hold for human review
3. Generate storyboard frames / deck from approved story
4. Hold for human storyboard review
5. Source stock or AI shots from the approved storyboard
6. Assemble a draft video
7. Hold for final approval
8. Publish only when explicitly approved

## MVP scope for this branch

This branch implements the minimum viable version of that model:

- Add **storyboard artifacts** as first-class pipeline output
- Add **manual approval gates** as first-class pipeline stages
- Add **halt/resume-safe semantics** to the runner so a run can stop cleanly at a gate
- Add **approval files** stored in the run directory
- Add **local storyboard sketch frames** (SVG) and an HTML deck
- Enforce **no upload without final approval**
- Add a **global asset manifest scaffold** for continuity

## Out of scope for MVP

These may follow in later branches:

- Web UI review/approve buttons
- Database-backed review workflow
- AI-generated storyboard images
- Per-scene inline comments in the web app
- Asset recommendation/ranking engine

## New pipeline shape

### Planning / gated production flow

- `topic-discovery`
- `research-pack`
- `script-generation`
- `script-approval-gate`
- `scene-plan`
- `storyboard-generation`
- `storyboard-approval-gate`
- `voiceover`
- `stock-footage`
- `assembly`
- `caption-overlay`
- `final-approval-gate`
- `upload`

### Behaviour

- If a required approval is missing or not approved:
  - the stage writes/updates the gate artifact
  - the runner logs the hold reason
  - the pipeline halts cleanly without marking the run as a crash
- Upload is only reachable when `final-approval-gate` is approved

## New artifacts

Each run directory should now be able to contain:

- `script.json`
- `storyboard.json`
- `storyboard-deck.html`
- `storyboard-frames/scene-01.svg`
- `storyboard-frames/scene-02.svg`
- `storyboard-frames/...`
- `approvals/script-gate.json`
- `approvals/storyboard-gate.json`
- `approvals/final-gate.json`
- `assets/asset-manifest.json`
- `HOLD.md`

## Approval model

### Status values

- `pending`
- `approved`
- `revisions_requested`
- `rejected`

### Gate IDs

- `script-gate`
- `storyboard-gate`
- `final-gate`

### Gate file schema

```json
{
  "gateId": "script-gate",
  "label": "Script approval",
  "status": "pending",
  "required": true,
  "updatedAt": "2026-04-25T12:34:56.000Z",
  "reviewer": null,
  "notes": null,
  "artifactPath": "script.json"
}
```

### Gate semantics

- `pending`: pipeline must halt at this stage
- `revisions_requested`: pipeline must halt
- `rejected`: pipeline must halt
- `approved`: pipeline may continue

## Storyboard model

Each storyboard scene should include:

- `sceneIndex`
- `title`
- `narration`
- `storyPurpose`
- `visualIntent`
- `camera`
- `composition`
- `motion`
- `caption`
- `seconds`
- `continuityNotes`
- `assetNeeds`
- `sketchFramePath`

The storyboard deck should include:

- run metadata
- brand metadata
- script hook/payoff
- ordered scene cards
- links/refs to frame files

## Storyboard rendering strategy (MVP)

For MVP, frames are rendered locally as stylised SVG sketch boards.

This is deliberate:

- zero extra provider risk
- deterministic output
- consistent format
- enough fidelity to review story, framing, and pacing
- avoids early distraction by polished visuals

Each frame should look like a rough agency board:

- monochrome background
- thick border
- scene label
- narration excerpt
- visual direction
- camera/composition notes
- motion arrows / placeholders where possible

## Continuity assets

Add first-class continuity scaffolding.

### Global assets

Path:

- `assets/global/asset-manifest.json`

Initial categories:

- `storyboardTemplates`
- `captionThemes`
- `motionPresets`
- `textures`
- `transitions`
- `musicBeds`
- `sfx`

### Brand continuity

Each brand may later define:

- visual motifs
- banned styles
- recurring framing language
- reference frames
- approved colour systems
- recurring overlays

MVP only adds the global scaffold and state fields needed to consume it later.

## Code changes

### Domain changes

Add models for:

- `ApprovalStatus`
- `ApprovalGateRecord`
- `StoryboardScene`
- `StoryboardDeck`
- `AssetManifest`

Extend `PipelineState` with:

- `storyboard?`
- `approvals?`
- `assetManifest?`
- `halted?`
- `haltReason?`

### Runner changes

The pipeline runner must support a clean halt:

- if a stage marks `state.halted = true`
- stop processing remaining stages
- log the halt reason
- return state without throwing

This is distinct from failure.

### New stages

- `ScriptApprovalGateStage`
- `StoryboardGenerationStage`
- `StoryboardApprovalGateStage`
- `FinalApprovalGateStage`

### Upload hardening

`UploadStage` must throw/refuse if final approval is not approved.

## CLI / operational behaviour

### Default behaviour

- Dry-run still means no media assembly/upload
- Full pipeline now halts at human gates unless approval files are already approved

### Human review loop

Operator can inspect the run directory, edit the approval file(s), then resume:

```bash
npx tsx src/generate.ts --brand=<id> --resume=<run-dir>
# or, to pick up the most recent halted run for the active brand:
npx tsx src/generate.ts --brand=<id> --resume=latest
# resume target also accepts a bare run id, e.g. --resume=20260425-093015
```

When `--resume` is set:

- the existing run dir is reused (no new `run-<timestamp>` is created)
- `PipelineState` is rehydrated from on-disk artifacts:
  `script.json`, `scene-plan.json`, `storyboard.json`, `voiceover.json`,
  `clips.json`, `assembled.mp4`, `final.mp4`, `approvals/*.json`,
  `assets/asset-manifest.json`
- each stage skips if its output is already in state (logged as
  `Resume: reusing …`); otherwise it runs normally
- the lane is read from the persisted topic — `--lane` is ignored on resume
- `topic-history.json` is **not** appended again on resume
- approval gates re-read their JSON from disk on every run, so editing
  `approvals/<gate>.json` to `"status": "approved"` lets the next resume
  pass through that gate

Stages that previously had no on-disk artifact now persist one to make
mid-pipeline resume robust:

- `scene-plan` writes `scene-plan.json`
- `voiceover` writes `voiceover.json` (subtitles + word timings)
- `stock-footage` writes `clips.json`

For MVP, the important thing is: **pipeline never silently publishes without explicit approval**.

## Acceptance criteria

This branch is done when:

- a clean run can generate `script.json`
- a clean run can generate `storyboard.json`
- storyboard SVG frames are created in `storyboard-frames/`
- `storyboard-deck.html` is created
- pipeline halts cleanly at `script-gate` when not approved
- pipeline halts cleanly at `storyboard-gate` when not approved
- pipeline halts cleanly at `final-gate` before upload when not approved
- upload stage cannot proceed without `final-gate: approved`
- a global continuity asset manifest scaffold exists
- a halted run can be continued in place via `--resume=<run-dir>` (or
  `--resume=latest`) after the operator edits the relevant approval file

## Follow-up branch ideas

- UI review controls for gate approval
- review comments and change requests
- storyboard PNG/PDF export
- AI rough frame generation behind a provider interface
- asset picker and continuity policy engine
