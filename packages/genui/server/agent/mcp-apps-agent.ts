// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Agent } from '@mastra/core/agent';

import { createLLMProvider } from './openai-provider';
import type { OpenAIProviderOptions } from './openai-provider';

const MCP_APPS_AGENT_INSTRUCTIONS = `You are an MCP Apps routing agent.

The client sends a system message containing the MCP Apps tools it registered.
Choose a registered tool only when it directly helps answer the latest user
request. Infer arguments from the current request and conversation context.

Return exactly one JSON object with no Markdown:
- Tool call: {"type":"tool_call","name":"registered.tool","arguments":{}}
- No matching app: {"type":"message","text":"short helpful response"}

Never invent a tool name, resource URI, schema field, or tool result. The host
executes the selected tool and renders its predeclared ui:// resource.`;

export interface McpAppsAgent {
  generate: (messages: unknown, options?: { resourceId?: string }) => unknown;
}

export function createMcpAppsAgent(opts: OpenAIProviderOptions = {}) {
  const { buildModel, model } = createLLMProvider(opts);
  const agent = new Agent({
    id: 'mcp-apps-agent',
    name: 'McpAppsAgent',
    instructions: MCP_APPS_AGENT_INSTRUCTIONS,
    model: buildModel(model),
  }) as unknown as McpAppsAgent;
  return { agent, model };
}
