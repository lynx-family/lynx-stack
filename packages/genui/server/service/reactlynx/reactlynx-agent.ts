// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createReactLynxAgent } from '../../agent/reactlynx/reactlynx-agent.js';
import {
  buildCapabilityRunOptions,
  pickAgentCapabilityConfig,
} from '../common/agent-capabilities.js';
import {
  buildConversationMessages,
  toModelMessages,
} from '../common/messages.js';
import { withTextModelInteraction } from '../common/model-interaction.js';
import { ProviderAgentCache } from '../common/provider.js';
import {
  extractGenerationResult,
  finalizeResult,
  toAsyncIterable,
} from '../common/result.js';
import type {
  ChatMessage,
  ChatOptions,
  ConversationContext,
  MastraResult,
  MastraStreamResult,
} from '../common/types.js';

class ReactLynxAgentService {
  private readonly agentCache = new ProviderAgentCache<
    ReturnType<typeof createReactLynxAgent>
  >();

  async generateRaw(
    messages: ChatMessage[],
    opts: ChatOptions = {},
    abortSignal?: AbortSignal,
  ): Promise<{ text: string; usage: unknown; finishReason: unknown }> {
    abortSignal?.throwIfAborted();
    const createAgent = () =>
      createReactLynxAgent(pickAgentCapabilityConfig(opts));
    const agent = opts.disableAgentCache
      ? createAgent()
      : await this.agentCache.get(opts, createAgent);
    abortSignal?.throwIfAborted();
    const result = await agent.generate(
      toModelMessages(messages),
      buildCapabilityRunOptions(opts, abortSignal, 'reactlynx'),
    ) as MastraResult;
    return extractGenerationResult(result);
  }

  async streamAsAsyncIterable(
    messages: ChatMessage[],
    opts: ChatOptions = {},
    conversation?: ConversationContext,
    abortSignal?: AbortSignal,
  ) {
    return withTextModelInteraction(
      opts.onModelInteraction,
      abortSignal,
      async () => {
        abortSignal?.throwIfAborted();
        const createAgent = () =>
          createReactLynxAgent(pickAgentCapabilityConfig(opts));
        const agent = opts.disableAgentCache
          ? createAgent()
          : await this.agentCache.get(opts, createAgent);
        abortSignal?.throwIfAborted();
        opts.onPerformanceEvent?.('agent.stream.invoke.started');
        const result = await agent.stream(
          toModelMessages(buildConversationMessages(messages, conversation)),
          buildCapabilityRunOptions(opts, abortSignal, 'reactlynx'),
        ) as MastraStreamResult;
        opts.onPerformanceEvent?.('agent.stream.invoke.completed');
        return {
          textStream: toAsyncIterable(result.textStream),
          finalize: () => finalizeResult(result),
        };
      },
    );
  }
}

const service = new ReactLynxAgentService();
export function getReactLynxAgentService() {
  return service;
}
