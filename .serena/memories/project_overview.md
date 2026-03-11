# VibePrinting overview
- Purpose: automation-first pipeline for generating, reviewing, and publishing AI-native YouTube Shorts with governance/GenSec controls.
- Current state: planning and pipeline contracts only; repo documents architecture, editorial plan, roadmap, and a hosted n8n workflow shape.
- Key docs: `docs/architecture.md`, `docs/editorial-plan.md`, `docs/n8n-workflow-spec.md`, `docs/roadmap.md`.
- Runtime shape: hosted `n8n` should orchestrate workflows; this repo is intended to become a TypeScript worker/service for prompts, scoring, schemas, GenSec decisions, and adapters.
- Initial channel thesis: `Compressed Curiosity` with lanes `history-flash`, `human-limits`, and `everyday-systems`.
- Source layout: `src/config.ts` loads env config, `src/domain/models.ts` defines pipeline contracts, `src/pipeline/blueprint.ts` contains the recommended theme and stage blueprint, `src/index.ts` prints the bootstrap plan.