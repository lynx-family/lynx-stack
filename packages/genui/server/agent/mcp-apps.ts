// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ToolsInput } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import {
  parseMcpAppsAgentSelection,
  resolveMcpAppsResource,
} from './mcp-apps-registry';
import type {
  McpAppsClientRegistry,
  McpAppsResource,
  McpAppsTool,
} from './mcp-apps-registry';

export const MCP_APP_TOOL_RESULT_TYPE = 'genui.mcp-app.tool-result';
export const MCP_APP_TOOL_CALL_TYPE = 'genui.mcp-app.tool-call';
const MCP_APPS_LIST_TOOL_NAME = 'mcp_apps_list';
const MCP_APPS_GET_TOOL_NAME = 'mcp_apps_get';
const MCP_APPS_CALL_TOOL_NAME = 'mcp_apps_call';

export interface McpAppExecutionContext {
  tool: McpAppsTool;
  resource: McpAppsResource;
}

export interface McpAppRegistration {
  name: string;
  resourceUri: string;
  execute: (
    input: Record<string, unknown>,
    context: McpAppExecutionContext,
  ) =>
    | Promise<Record<string, unknown>>
    | Record<string, unknown>;
}

export interface McpAppToolResult {
  type: typeof MCP_APP_TOOL_RESULT_TYPE;
  callId: string;
  toolName: string;
  resourceUri: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
}

export interface McpAppToolCall {
  type: typeof MCP_APP_TOOL_CALL_TYPE;
  callId: string;
  toolName: string;
  resourceUri: string;
  input: Record<string, unknown>;
}

export type McpAppInvocation = McpAppToolCall | McpAppToolResult;

export interface McpAppDescriptor {
  name: string;
  title?: string;
  description?: string;
  resourceUri: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpAppsModelToolOutput {
  type: 'json';
  value: unknown;
}

export interface CreateMcpAppsToolsOptions {
  callToModelOutput?: (
    value: unknown,
  ) => McpAppsModelToolOutput;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function mcpAppToolResourceUri(
  tool: McpAppsTool,
): string | undefined {
  const modern = tool._meta.ui?.resourceUri;
  if (typeof modern === 'string') return modern;
  const legacy = tool._meta['ui/resourceUri'];
  return typeof legacy === 'string' ? legacy : undefined;
}

export function mcpAppToolIsVisibleToModel(tool: McpAppsTool): boolean {
  return tool._meta.ui?.visibility?.includes('model') ?? true;
}

function descriptor(
  tool: McpAppsTool,
  includeInputSchema: boolean,
): McpAppDescriptor | null {
  const resourceUri = mcpAppToolResourceUri(tool);
  if (!resourceUri) return null;
  return {
    name: tool.name,
    ...(tool.title ? { title: tool.title } : {}),
    ...(tool.description ? { description: tool.description } : {}),
    resourceUri,
    ...(includeInputSchema ? { inputSchema: tool.inputSchema } : {}),
  };
}

export class McpAppRegistry {
  readonly #registrations = new Map<string, McpAppRegistration>();

  public register(registration: McpAppRegistration): () => void {
    if (!registration.name) {
      throw new Error('MCP App registration name is required');
    }
    if (!registration.resourceUri.startsWith('ui://')) {
      throw new Error(
        `MCP App ${registration.name} must register a ui:// resource`,
      );
    }
    this.#registrations.set(registration.name, registration);
    return () => {
      if (this.#registrations.get(registration.name) === registration) {
        this.#registrations.delete(registration.name);
      }
    };
  }

  public has(name: string): boolean {
    return this.#registrations.has(name);
  }

  private resolveClient(
    clientRegistry: McpAppsClientRegistry,
    name: string,
  ): {
    tool: McpAppsTool;
    resource: McpAppsResource;
  } | null {
    const tool = clientRegistry.tools.find(candidate =>
      candidate.name === name
      && mcpAppToolIsVisibleToModel(candidate)
    );
    if (!tool) return null;
    const resource = resolveMcpAppsResource(tool, clientRegistry);
    return { tool, resource };
  }

  public list(
    clientRegistry: McpAppsClientRegistry,
    query?: string,
  ): McpAppDescriptor[] {
    const normalizedQuery = query?.trim().toLowerCase();
    return clientRegistry.tools.flatMap((tool) => {
      if (!this.resolveClient(clientRegistry, tool.name)) return [];
      const value = descriptor(tool, false);
      if (!value) return [];
      if (!normalizedQuery) return [value];
      const searchable = [
        value.name,
        value.title,
        value.description,
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(normalizedQuery) ? [value] : [];
    });
  }

  public get(
    clientRegistry: McpAppsClientRegistry,
    name: string,
  ): McpAppDescriptor | null {
    const resolved = this.resolveClient(clientRegistry, name);
    return resolved ? descriptor(resolved.tool, true) : null;
  }

  public async call(
    clientRegistry: McpAppsClientRegistry,
    name: string,
    input: Record<string, unknown>,
  ): Promise<McpAppInvocation> {
    const selection = parseMcpAppsAgentSelection(
      JSON.stringify({ type: 'tool_call', name, arguments: input }),
      clientRegistry,
    );
    if (selection.type !== 'tool_call') {
      throw new Error(`MCP App ${name} did not resolve to a tool call`);
    }
    const resolved = this.resolveClient(clientRegistry, selection.name);
    if (!resolved) {
      throw new Error(`MCP App ${selection.name} is not registered`);
    }
    const callId = crypto.randomUUID();
    const registration = this.#registrations.get(selection.name);
    if (
      !registration
      || registration.resourceUri !== resolved.resource.uri
    ) {
      return {
        type: MCP_APP_TOOL_CALL_TYPE,
        callId,
        toolName: selection.name,
        resourceUri: resolved.resource.uri,
        input: selection.arguments,
      };
    }
    const result = await registration.execute(selection.arguments, {
      tool: resolved.tool,
      resource: resolved.resource,
    });
    if (!isRecord(result)) {
      throw new Error(`MCP App ${selection.name} returned invalid data`);
    }
    return {
      type: MCP_APP_TOOL_RESULT_TYPE,
      callId,
      toolName: selection.name,
      resourceUri: registration.resourceUri,
      input: selection.arguments,
      result,
    };
  }
}

function parseMcpAppToolResult(value: unknown): McpAppToolResult | null {
  if (!isRecord(value) || value.type !== MCP_APP_TOOL_RESULT_TYPE) return null;
  if (
    typeof value.callId !== 'string'
    || typeof value.toolName !== 'string'
    || typeof value.resourceUri !== 'string'
    || !isRecord(value.input)
    || !isRecord(value.result)
  ) {
    return null;
  }
  return value as unknown as McpAppToolResult;
}

function parseMcpAppToolCall(value: unknown): McpAppToolCall | null {
  if (!isRecord(value) || value.type !== MCP_APP_TOOL_CALL_TYPE) return null;
  if (
    typeof value.callId !== 'string'
    || typeof value.toolName !== 'string'
    || typeof value.resourceUri !== 'string'
    || !isRecord(value.input)
  ) {
    return null;
  }
  return value as unknown as McpAppToolCall;
}

export function parseMcpAppInvocation(
  value: unknown,
): McpAppInvocation | null {
  return parseMcpAppToolResult(value) ?? parseMcpAppToolCall(value);
}

function modelToolOutput(value: unknown): McpAppsModelToolOutput {
  const output = parseMcpAppInvocation(value);
  const summary = output?.type === MCP_APP_TOOL_RESULT_TYPE
      && typeof output.result.summary === 'string'
    ? output.result.summary
    : 'The registered MCP App call was accepted by the host.';
  return {
    type: 'json' as const,
    value: {
      ...(output ? { invocation: output } : {}),
      summary,
      instruction:
        'Use this registered MCP App result only if it helps answer the request, then continue the active output protocol.',
    },
  };
}

export function createMcpAppsTools(
  clientRegistry: McpAppsClientRegistry,
  apps: McpAppRegistry,
  options: CreateMcpAppsToolsOptions = {},
): ToolsInput {
  return {
    [MCP_APPS_LIST_TOOL_NAME]: createTool({
      id: MCP_APPS_LIST_TOOL_NAME,
      description:
        'List the MCP Apps currently registered for this request. Use this before assuming which business apps are available.',
      inputSchema: z.object({}).strict(),
      execute: async () => ({
        apps: apps.list(clientRegistry),
      }),
    }),
    [MCP_APPS_GET_TOOL_NAME]: createTool({
      id: MCP_APPS_GET_TOOL_NAME,
      description:
        'Get the complete description and input schema for one registered MCP App.',
      inputSchema: z.object({
        name: z.string().min(1),
      }).strict(),
      execute: ({ name }) => {
        const app = apps.get(clientRegistry, name);
        if (!app) throw new Error(`MCP App ${name} is not registered`);
        return Promise.resolve({ app });
      },
    }),
    [MCP_APPS_CALL_TOOL_NAME]: createTool({
      id: MCP_APPS_CALL_TOOL_NAME,
      description:
        'Invoke a registered MCP App using arguments that match the schema returned by mcp_apps_get.',
      inputSchema: z.object({
        name: z.string().min(1),
        arguments: z.record(z.string(), z.unknown()),
      }).strict(),
      execute: async ({ name, arguments: input }) =>
        apps.call(clientRegistry, name, input),
      toModelOutput: options.callToModelOutput ?? modelToolOutput,
    }),
  };
}

export function findMcpAppToolResult(
  toolResults: unknown,
): McpAppToolResult | null {
  const invocation = findMcpAppInvocation(toolResults);
  return invocation?.type === MCP_APP_TOOL_RESULT_TYPE ? invocation : null;
}

export function findMcpAppInvocation(
  toolResults: unknown,
): McpAppInvocation | null {
  if (!Array.isArray(toolResults)) return null;
  for (let index = toolResults.length - 1; index >= 0; index--) {
    const item: unknown = toolResults[index];
    if (!isRecord(item)) continue;
    const payload = isRecord(item.payload) ? item.payload : item;
    const result = parseMcpAppInvocation(payload.result);
    if (result) return result;
  }
  return null;
}
