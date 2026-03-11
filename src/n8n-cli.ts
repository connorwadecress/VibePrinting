import { readFile } from "node:fs/promises";
import path from "node:path";
import { ScopedN8nClient, extractWorkflowDefinition } from "./n8n/api.js";

function usage(): never {
  throw new Error(
    [
      "Usage:",
      "  npm run n8n -- scope",
      "  npm run n8n -- list",
      "  npm run n8n -- get <workflowId>",
      "  npm run n8n -- execution <executionId>",
      "  npm run n8n -- create <workflowJsonPath>",
      "  npm run n8n -- update <workflowId> <workflowJsonPath>",
      "  npm run n8n -- delete <workflowId>",
      "  npm run n8n -- webhook <workflowId> <bodyJsonPath>"
    ].join("\n")
  );
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  const raw = await readFile(resolved, "utf8");
  return JSON.parse(raw);
}

async function main(): Promise<void> {
  const client = new ScopedN8nClient();
  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case "scope": {
      const scope = await client.getScope();
      console.log(JSON.stringify(scope, null, 2));
      return;
    }

    case "list": {
      const workflows = await client.listScopedWorkflows();
      console.log(JSON.stringify(workflows, null, 2));
      return;
    }

    case "get": {
      const [workflowId] = rest;
      if (!workflowId) {
        usage();
      }

      const workflow = await client.getWorkflow(workflowId);
      console.log(JSON.stringify(workflow, null, 2));
      return;
    }

    case "execution": {
      const [executionId] = rest;
      if (!executionId) {
        usage();
      }

      const execution = await client.getExecution(executionId);
      console.log(JSON.stringify(execution, null, 2));
      return;
    }

    case "create": {
      const [workflowPath] = rest;
      if (!workflowPath) {
        usage();
      }

      const workflow = extractWorkflowDefinition(await readJsonFile(workflowPath));
      const created = await client.createWorkflow(workflow);
      console.log(JSON.stringify(created, null, 2));
      return;
    }

    case "update": {
      const [workflowId, workflowPath] = rest;
      if (!workflowId || !workflowPath) {
        usage();
      }

      const workflow = extractWorkflowDefinition(await readJsonFile(workflowPath));
      const updated = await client.updateWorkflow(workflowId, workflow);
      console.log(JSON.stringify(updated, null, 2));
      return;
    }

    case "delete": {
      const [workflowId] = rest;
      if (!workflowId) {
        usage();
      }

      const deleted = await client.deleteWorkflow(workflowId);
      console.log(JSON.stringify(deleted, null, 2));
      return;
    }

    case "webhook": {
      const [workflowId, bodyPath] = rest;
      if (!workflowId || !bodyPath) {
        usage();
      }

      const result = await client.executeProductionWebhook(workflowId, await readJsonFile(bodyPath));
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    default:
      usage();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
