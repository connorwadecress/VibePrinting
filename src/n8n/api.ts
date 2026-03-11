import { loadConfig } from "../config.js";
import {
  assertWorkflowInScope,
  assertWorkflowNameInScope,
  loadScope,
  registerWorkflow,
  unregisterWorkflow,
  type N8nScopeConfig,
  type N8nWorkflowRef
} from "./scope.js";

export interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  webhookId?: string;
  onError?: string;
}

export interface N8nWorkflowDefinition {
  name: string;
  nodes: N8nNode[];
  connections: Record<string, unknown>;
  settings: Record<string, unknown>;
}

export interface N8nWorkflow extends N8nWorkflowDefinition {
  id: string;
  active: boolean;
  description?: string | null;
  isArchived?: boolean;
  shared?: Array<{
    projectId?: string;
  }>;
}

export interface N8nExecutionSummary {
  id: string;
  workflowId: string;
  status: string;
  mode: string;
  createdAt: string;
  startedAt?: string | null;
  stoppedAt?: string | null;
  finished?: boolean;
}

interface RequestOptions {
  body?: unknown;
}

function normalizeApiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/api/v1") ? trimmed : `${trimmed}/api/v1`;
}

function extractWorkflowDefinition(input: unknown): N8nWorkflowDefinition {
  const source = input as Partial<N8nWorkflowDefinition> & { workflow?: Partial<N8nWorkflowDefinition> };
  const candidate = source.workflow ?? source;

  if (!candidate.name || !Array.isArray(candidate.nodes) || typeof candidate.connections !== "object") {
    throw new Error("Workflow file must contain at least name, nodes, connections, and settings.");
  }

  return {
    name: String(candidate.name),
    nodes: candidate.nodes as N8nNode[],
    connections: (candidate.connections ?? {}) as Record<string, unknown>,
    settings: (candidate.settings ?? {}) as Record<string, unknown>
  };
}

export class ScopedN8nClient {
  private readonly apiBaseUrl: string;

  private readonly apiKey: string;

  private readonly scopeFile: string;

  private readonly scopePromise: Promise<N8nScopeConfig>;

  constructor() {
    const config = loadConfig();

    if (!config.n8nBaseUrl) {
      throw new Error("N8N_BASE_URL is required.");
    }

    if (!config.n8nApiKey) {
      throw new Error("N8N_API_KEY is required.");
    }

    this.apiBaseUrl = normalizeApiBaseUrl(config.n8nBaseUrl);
    this.apiKey = config.n8nApiKey;
    this.scopeFile = config.n8nScopeFile;
    this.scopePromise = loadScope(config.n8nScopeFile, config.n8nWorkflowPrefix);
  }

  async getScope(): Promise<N8nScopeConfig> {
    return this.scopePromise;
  }

  async listScopedWorkflows(): Promise<N8nWorkflow[]> {
    const scope = await this.getScope();
    const workflows = await Promise.all(
      scope.allowedWorkflowIds.map(async (workflowId) => {
        try {
          return await this.getWorkflow(workflowId);
        } catch {
          return undefined;
        }
      })
    );

    return workflows
      .filter((workflow): workflow is N8nWorkflow => Boolean(workflow))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async getWorkflow(workflowId: string): Promise<N8nWorkflow> {
    const workflow = await this.request<N8nWorkflow>("GET", `/workflows/${encodeURIComponent(workflowId)}`);
    const scope = await this.getScope();
    assertWorkflowInScope(workflow, scope);
    await registerWorkflow(this.scopeFile, scope, workflow);
    return workflow;
  }

  async createWorkflow(input: unknown): Promise<N8nWorkflow> {
    const scope = await this.getScope();
    const definition = extractWorkflowDefinition(input);
    assertWorkflowNameInScope(definition.name, scope);

    const workflow = await this.request<N8nWorkflow>("POST", "/workflows", {
      body: definition
    });

    await registerWorkflow(this.scopeFile, scope, workflow);
    return workflow;
  }

  async updateWorkflow(workflowId: string, input: unknown): Promise<N8nWorkflow> {
    const scope = await this.getScope();
    const current = await this.getWorkflow(workflowId);
    const next = extractWorkflowDefinition(input);
    assertWorkflowInScope(current, scope);
    assertWorkflowNameInScope(next.name, scope);

    const updated = await this.request<N8nWorkflow>("PUT", `/workflows/${encodeURIComponent(workflowId)}`, {
      body: next
    });

    await registerWorkflow(this.scopeFile, scope, updated);
    return updated;
  }

  async deleteWorkflow(workflowId: string): Promise<N8nWorkflow> {
    const scope = await this.getScope();
    await this.getWorkflow(workflowId);
    const deleted = await this.request<N8nWorkflow>("DELETE", `/workflows/${encodeURIComponent(workflowId)}`);
    await unregisterWorkflow(this.scopeFile, scope, workflowId);
    return deleted;
  }

  async getExecution(executionId: string): Promise<N8nExecutionSummary> {
    const execution = await this.request<N8nExecutionSummary>("GET", `/executions/${encodeURIComponent(executionId)}`);
    await this.getWorkflow(execution.workflowId);
    return execution;
  }

  async executeProductionWebhook(workflowId: string, body: unknown, method = "POST"): Promise<unknown> {
    const workflow = await this.getWorkflow(workflowId);
    const webhookNode = workflow.nodes.find((node) => node.type === "n8n-nodes-base.webhook");

    if (!webhookNode) {
      throw new Error(`Workflow ${workflowId} does not contain a Webhook node.`);
    }

    const pathValue = webhookNode.parameters.path;
    if (typeof pathValue !== "string" || pathValue.trim().length === 0) {
      throw new Error(`Workflow ${workflowId} has no static webhook path.`);
    }

    const webhookPath = pathValue.replace(/^\/+/, "");
    const url = `${this.apiBaseUrl.replace(/\/api\/v1$/, "")}/webhook/${webhookPath}`;

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Webhook call failed with ${response.status}: ${message}`);
    }

    return response.json();
  }

  private async request<T>(method: string, route: string, options?: RequestOptions): Promise<T> {
    const response = await fetch(`${this.apiBaseUrl}${route}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-N8N-API-KEY": this.apiKey
      },
      body: options?.body ? JSON.stringify(options.body) : undefined
    });

    const text = await response.text();
    const payload = text.length > 0 ? JSON.parse(text) : undefined;

    if (!response.ok) {
      const detail = payload && typeof payload === "object" && "message" in payload ? String(payload.message) : text;
      throw new Error(`n8n API ${method} ${route} failed with ${response.status}: ${detail}`);
    }

    return payload as T;
  }
}

export { extractWorkflowDefinition };
