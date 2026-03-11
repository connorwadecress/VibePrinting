# Vibe Printing Topic Planner Workflow

This is the first workflow to publish for MCP access.

It is intentionally narrow:

- supported MCP trigger: `Webhook`
- no external credentials required
- returns structured topic candidates for the Vibe Printing editorial lanes
- safe starter workflow that Codex can execute immediately once published

## Import path

Use [`docs/workflows/vibe-printing-topic-planner.workflow.json`](C:\Users\ConnorCress\source\PersonalDev\VibePrinting\docs\workflows\vibe-printing-topic-planner.workflow.json) in n8n's import flow.

## Recommended workflow description

Paste this into the workflow description in n8n so MCP clients understand the contract:

```text
Generate a Vibe Printing daily topic batch for the Compressed Curiosity channel. Accepts webhook JSON with optional fields: dailyTarget (1-6), backlogPerLane (1-6), laneIds (history-flash, human-limits, everyday-systems), and recentAngles (array of recently used topic titles to avoid). Returns selectedCandidates, backlogCandidates, publishSlots, and operatorChecklist. Use this as the planning entry point before research, script generation, and GenSec review.
```

## Expected input

Send a `POST` request to the workflow webhook with JSON like:

```json
{
  "dailyTarget": 3,
  "backlogPerLane": 4,
  "laneIds": ["history-flash", "everyday-systems"],
  "recentAngles": [
    "Why Roman concrete survived for centuries"
  ]
}
```

All fields are optional.

## What it returns

The workflow returns JSON with:

- `selectedCandidates`: the batch to work now
- `backlogCandidates`: extra topic ideas to queue
- `theme`: current thesis and publish slots
- `operatorChecklist`: human review rules for the current stage

## Publish checklist

1. Import the JSON workflow into n8n.
2. Save it.
3. Publish and activate it.
4. Turn on `Available in MCP`.
5. Keep `Webhook` as the only supported trigger in this workflow so MCP clients have a single clear execution path.

## After this workflow

The next useful MCP-exposed workflows are:

1. `research-pack-builder`
2. `short-script-generator`
3. `gensec-text-check`

Those can stay as separate workflows so Codex can call them independently and chain them in a controlled way.
