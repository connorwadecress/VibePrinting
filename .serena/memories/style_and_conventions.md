# Style and conventions
- Language: TypeScript with ESM (`"type": "module"`).
- Code style: explicit interfaces for domain models, small pure functions, simple string/array building, no heavy framework patterns.
- Naming: camelCase for variables/functions, PascalCase for interfaces/types, kebab-case for docs/workflow filenames.
- Project posture: architecture-first and ops-aware; avoid assuming local filesystem access from hosted n8n.
- Workflow design guidance: prefer webhook- or HTTP-based boundaries between n8n and this repo; pass URLs/object keys rather than local file paths.
- Editorial/governance guidance: GenSec checks are required before autopublish; shadow-review mode is the default operational posture.