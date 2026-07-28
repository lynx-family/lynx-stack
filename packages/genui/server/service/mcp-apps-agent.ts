// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { McpAppRegistry, createMcpAppsTools } from '../agent/mcp-apps';
import { createMcpAppsAgent } from '../agent/mcp-apps-agent';
import type { McpAppsAgent } from '../agent/mcp-apps-agent';
import type { McpAppsClientRegistry } from '../agent/mcp-apps-registry';
import { buildConversationMessages, toModelMessages } from './common/messages';
import {
  ProviderAgentCache,
  buildResourceRunOptions,
  createStableValueHash,
  pickProviderConfig,
} from './common/provider';
import { extractGenerationResult } from './common/result';
import type {
  ChatMessage,
  ChatOptions,
  ConversationContext,
  MastraResult,
} from './common/types';

export class McpAppsAgentService {
  private readonly agentCache = new ProviderAgentCache<McpAppsAgent>();
  private readonly hostApps = new McpAppRegistry();

  private getAgent(
    opts: ChatOptions,
    registry: McpAppsClientRegistry,
  ): Promise<McpAppsAgent> {
    return this.agentCache.get(
      opts,
      () =>
        createMcpAppsAgent({
          ...pickProviderConfig(opts),
          tools: createMcpAppsTools(registry, this.hostApps),
        }).agent,
      createStableValueHash(registry),
    );
  }

  public async generateRaw(
    messages: ChatMessage[],
    registry: McpAppsClientRegistry,
    opts: ChatOptions = {},
    conversation?: ConversationContext,
    abortSignal?: AbortSignal,
  ): Promise<{
    text: string;
    usage: unknown;
    finishReason: unknown;
    toolResults: unknown;
  }> {
    abortSignal?.throwIfAborted();
    const agent = await this.getAgent(opts, registry);
    abortSignal?.throwIfAborted();
    const modelMessages = toModelMessages(
      buildConversationMessages(messages, conversation),
    );
    const result = await agent.generate(
      modelMessages,
      {
        ...buildResourceRunOptions(opts, abortSignal),
        maxSteps: 4,
      },
    ) as MastraResult;
    return extractGenerationResult(result);
  }
}

const SERVICE_KEY = '__MCP_APPS_AGENT_SERVICE__';
type GlobalWithService = typeof globalThis & {
  [SERVICE_KEY]?: McpAppsAgentService;
};

export function getMcpAppsAgentService(): McpAppsAgentService {
  const global = globalThis as GlobalWithService;
  if (typeof global[SERVICE_KEY]?.generateRaw !== 'function') {
    global[SERVICE_KEY] = new McpAppsAgentService();
  }
  return global[SERVICE_KEY];
}
