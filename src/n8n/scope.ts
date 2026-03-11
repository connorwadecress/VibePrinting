import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface N8nWorkflowRef {
  id: string;
  name: string;
}

export interface N8nScopeConfig {
  workflowNamePrefix: string;
  allowedWorkflowIds: string[];
  notes?: string[];
}

const DEFAULT_NOTES = [
  "This file is the local safety rail for Codex-driven n8n work.",
  "Only workflows with the Vibe Printing prefix or an allowlisted ID are in scope.",
  "This is not server-side isolation. Real isolation requires a separate n8n user, project, or instance."
];

export function resolveScopeFile(scopeFile: string): string {
  return path.isAbsolute(scopeFile) ? scopeFile : path.resolve(process.cwd(), scopeFile);
}

export async function loadScope(scopeFile: string, workflowNamePrefix: string): Promise<N8nScopeConfig> {
  const resolved = resolveScopeFile(scopeFile);

  try {
    const raw = await readFile(resolved, "utf8");
    const parsed = JSON.parse(raw) as Partial<N8nScopeConfig>;

    return {
      workflowNamePrefix: parsed.workflowNamePrefix ?? workflowNamePrefix,
      allowedWorkflowIds: Array.isArray(parsed.allowedWorkflowIds)
        ? [...new Set(parsed.allowedWorkflowIds.map((id) => String(id)))]
        : [],
      notes: parsed.notes ?? DEFAULT_NOTES
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    return {
      workflowNamePrefix,
      allowedWorkflowIds: [],
      notes: DEFAULT_NOTES
    };
  }
}

export async function saveScope(scopeFile: string, scope: N8nScopeConfig): Promise<void> {
  const resolved = resolveScopeFile(scopeFile);
  const normalized: N8nScopeConfig = {
    workflowNamePrefix: scope.workflowNamePrefix,
    allowedWorkflowIds: [...new Set(scope.allowedWorkflowIds)].sort(),
    notes: scope.notes ?? DEFAULT_NOTES
  };

  await writeFile(`${resolved}`, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

export function isWorkflowNameInScope(name: string, scope: N8nScopeConfig): boolean {
  return name.startsWith(scope.workflowNamePrefix);
}

export function isWorkflowInScope(workflow: N8nWorkflowRef, scope: N8nScopeConfig): boolean {
  return isWorkflowNameInScope(workflow.name, scope) || scope.allowedWorkflowIds.includes(workflow.id);
}

export function assertWorkflowNameInScope(name: string, scope: N8nScopeConfig): void {
  if (!isWorkflowNameInScope(name, scope)) {
    throw new Error(
      `Workflow name "${name}" is out of scope. Names must start with "${scope.workflowNamePrefix}".`
    );
  }
}

export function assertWorkflowInScope(workflow: N8nWorkflowRef, scope: N8nScopeConfig): void {
  if (!isWorkflowInScope(workflow, scope)) {
    throw new Error(
      `Workflow ${workflow.id} (${workflow.name}) is out of scope. Refusing to operate outside the Vibe Printing namespace.`
    );
  }
}

export async function registerWorkflow(scopeFile: string, scope: N8nScopeConfig, workflow: N8nWorkflowRef): Promise<void> {
  assertWorkflowNameInScope(workflow.name, scope);

  if (scope.allowedWorkflowIds.includes(workflow.id)) {
    return;
  }

  scope.allowedWorkflowIds.push(workflow.id);
  await saveScope(scopeFile, scope);
}

export async function unregisterWorkflow(scopeFile: string, scope: N8nScopeConfig, workflowId: string): Promise<void> {
  const nextIds = scope.allowedWorkflowIds.filter((id) => id !== workflowId);

  if (nextIds.length === scope.allowedWorkflowIds.length) {
    return;
  }

  scope.allowedWorkflowIds = nextIds;
  await saveScope(scopeFile, scope);
}
