// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createMcpAppsAgent } from '../../agent/mcp-apps/mcp-apps-agent.js';
import type { McpAppsAgent } from '../../agent/mcp-apps/mcp-apps-agent.js';
import {
  buildSearchRunOptions,
  pickSearchAgentConfig,
} from '../common/agent-capabilities.js';
import {
  buildConversationMessages,
  toModelMessages,
} from '../common/messages.js';
import { ProviderAgentCache } from '../common/provider.js';
import { extractGenerationResult } from '../common/result.js';
import type {
  ChatMessage,
  ChatOptions,
  ConversationContext,
  MastraResult,
} from '../common/types.js';

export class McpAppsAgentService {
  private readonly agentCache = new ProviderAgentCache<McpAppsAgent>();

  private getAgent(opts: ChatOptions): Promise<McpAppsAgent> {
    const createAgent = () =>
      createMcpAppsAgent(pickSearchAgentConfig(opts)).agent;
    if (opts.disableAgentCache) return Promise.resolve().then(createAgent);
    return this.agentCache.get(
      opts,
      createAgent,
    );
  }

  public async generateRaw(
    messages: ChatMessage[],
    opts: ChatOptions = {},
    conversation?: ConversationContext,
    abortSignal?: AbortSignal,
  ): Promise<{
    text: string;
    usage: unknown;
    finishReason: unknown;
  }> {
    abortSignal?.throwIfAborted();
    const agent = await this.getAgent(opts);
    abortSignal?.throwIfAborted();
    const modelMessages = toModelMessages(
      buildConversationMessages(messages, conversation),
    );
    const result = await agent.generate(
      modelMessages,
      buildSearchRunOptions(opts, abortSignal),
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
