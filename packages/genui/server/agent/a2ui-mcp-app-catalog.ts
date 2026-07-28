// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { A2UICatalogExtension } from './a2ui-agent';
import {
  MCP_APP_TOOL_RESULT_TYPE,
  createMcpAppsTools,
  parseMcpAppInvocation,
} from './mcp-apps';
import type {
  McpAppInvocation,
  McpAppRegistry,
  McpAppsModelToolOutput,
} from './mcp-apps';
import type {
  McpAppsClientRegistry,
  McpAppsResource,
} from './mcp-apps-registry';

export const A2UI_MCP_APPS_SYSTEM_APPENDIX = `# Registered MCP Apps

McpApp is a generic component in the active A2UI catalog. Its props come from
MCP Apps registered for the current request. Do not assume which business apps
are installed.
- Always call mcp_apps_list without a query before composing the A2UI response.
- If no listed app matches the request, do not call another MCP Apps tool.
  Continue with a normal A2UI response using the rest of the active catalog.
- If a listed app matches the request, call mcp_apps_get for its complete input
  schema, then call mcp_apps_call with schema-compliant arguments.
- Never fabricate data that a registered app can provide.
- When mcp_apps_call returns a McpApp component, emit that component directly
  and copy its returned props exactly. Do not replace it with simulated data or
  a hand-built substitute. You may combine it with other catalog components.
  Never invent or alter its bundle URLs, renderer data, tool input, tool call,
  or result.`;

interface McpAppTemplate {
  renderer: string;
  nativeBundle: string;
  webBundle?: string;
}

type A2UIMcpAppPrepareStepResult = {
  toolChoice: { type: 'tool'; toolName: 'mcp_apps_list' };
  activeTools: ['mcp_apps_list'];
} | undefined;

export function prepareA2UIMcpAppStep(
  { stepNumber }: { stepNumber: number },
): A2UIMcpAppPrepareStepResult {
  if (stepNumber !== 0) return undefined;
  return {
    toolChoice: { type: 'tool', toolName: 'mcp_apps_list' },
    activeTools: ['mcp_apps_list'],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function createA2UIMcpAppCatalogExtension(
  clientRegistry: McpAppsClientRegistry,
  apps: McpAppRegistry,
): A2UICatalogExtension {
  return {
    id: 'mcp-apps',
    component: 'McpApp',
    systemAppendix: A2UI_MCP_APPS_SYSTEM_APPENDIX,
    tools: createMcpAppsTools(clientRegistry, apps, {
      callToModelOutput: value =>
        createA2UIMcpAppModelOutput(value, clientRegistry),
    }),
  };
}

function safeBundleReference(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const reference = value.trim();
  if (reference.startsWith('./') || reference.startsWith('/')) return reference;
  try {
    const url = new URL(reference);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? reference
      : undefined;
  } catch {
    return undefined;
  }
}

function readTemplate(resource: McpAppsResource): McpAppTemplate | null {
  const metadata = resource._meta;
  if (!isRecord(metadata)) return null;
  const value = metadata['lynxjs/template'];
  if (!isRecord(value) || typeof value.renderer !== 'string') return null;
  const nativeBundle = safeBundleReference(value.nativeBundle);
  if (!nativeBundle) return null;
  const webBundle = safeBundleReference(value.webBundle);
  return {
    renderer: value.renderer,
    nativeBundle,
    ...(webBundle ? { webBundle } : {}),
  };
}

function createMcpAppComponent(
  invocation: McpAppInvocation,
  registry: McpAppsClientRegistry,
): Record<string, unknown> | null {
  const tool = registry.tools.find(candidate =>
    candidate.name === invocation.toolName
    && (
        candidate._meta.ui?.resourceUri
          ?? candidate._meta['ui/resourceUri']
      ) === invocation.resourceUri
  );
  if (!tool) return null;
  const resource = registry.resources.find(item =>
    item.uri === invocation.resourceUri
  );
  if (!resource) return null;
  const template = readTemplate(resource);
  if (!template) return null;

  return {
    component: 'McpApp',
    props: {
      url: template.nativeBundle,
      ...(template.webBundle ? { webUrl: template.webBundle } : {}),
      autoHeight: true,
      height: 520,
      mcpAppData: {
        renderer: template.renderer,
        input: invocation.input,
        ...(invocation.type === MCP_APP_TOOL_RESULT_TYPE
          ? { result: invocation.result }
          : {
            toolCall: {
              jsonrpc: '2.0',
              id: invocation.callId,
              method: 'tools/call',
              params: {
                name: invocation.toolName,
                arguments: invocation.input,
              },
            },
          }),
      },
    },
  };
}

export function createA2UIMcpAppModelOutput(
  value: unknown,
  registry: McpAppsClientRegistry,
): McpAppsModelToolOutput {
  const invocation = parseMcpAppInvocation(value);
  const summary = invocation?.type === MCP_APP_TOOL_RESULT_TYPE
      && typeof invocation.result.summary === 'string'
    ? invocation.result.summary
    : 'The registered MCP App call was accepted by the host.';
  const mcpApp = invocation
    ? createMcpAppComponent(invocation, registry)
    : null;
  return {
    type: 'json',
    value: {
      summary,
      ...(mcpApp ? { mcpApp } : {}),
      instruction: mcpApp
        ? 'A matching registered MCP App was invoked. Emit a valid A2UI McpApp component now and copy every returned prop exactly; choose only its component id and surrounding layout. Do not replace it with simulated data or a hand-built substitute.'
        : 'The selected app did not resolve to a registered trusted A2UI template. Do not render a McpApp component; continue with a normal A2UI response.',
    },
  };
}
