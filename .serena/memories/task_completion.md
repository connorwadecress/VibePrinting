# Task completion
- Run `npm run check` for code changes affecting TypeScript source.
- For workflow/spec changes, validate JSON parses and sanity-check any embedded logic with a representative sample payload.
- Preserve the hosted-n8n assumption unless the user explicitly changes architecture.
- If adding MCP-facing workflows, ensure they use a supported trigger and have a clear workflow description for MCP clients.