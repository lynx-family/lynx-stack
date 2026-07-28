// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';
import type { ToolsInput } from '@mastra/core/agent';

import { createLLMProvider } from './openai-provider';
import type { OpenAIProviderOptions } from './openai-provider';

const MCP_APPS_AGENT_INSTRUCTIONS = `You are an MCP Apps routing agent.

Use the generic MCP Apps discovery and invocation tools to inspect what the
client registered. Choose a registered app only when it directly helps answer
the latest user request. Infer arguments from the current request and
conversation context.

When an app matches, call mcp_apps_list, optionally mcp_apps_get, and then
mcp_apps_call. When no app matches, return exactly one JSON object with no
Markdown: {"type":"message","text":"short helpful response"}.

Never invent a tool name, resource URI, schema field, or tool result. The host
executes the selected tool and renders its predeclared ui:// resource.`;

export interface McpAppsAgent {
  generate: (
    messages: unknown,
    options?: { resourceId?: string; maxSteps?: number },
  ) => unknown;
}

export interface McpAppsAgentOptions extends OpenAIProviderOptions {
  tools?: ToolsInput | undefined;
}

export function createMcpAppsAgent(opts: McpAppsAgentOptions = {}) {
  const { buildModel, model } = createLLMProvider(opts);
  const agent = new Agent({
    id: 'mcp-apps-agent',
    name: 'McpAppsAgent',
    instructions: MCP_APPS_AGENT_INSTRUCTIONS,
    model: buildModel(model),
    ...(opts.tools && Object.keys(opts.tools).length > 0
      ? { tools: opts.tools }
      : {}),
  }) as unknown as McpAppsAgent;
  return { agent, model };
}
