// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  buildCapabilityRunOptions,
  pickAgentCapabilityConfig,
} from './agent-capabilities.js';
import {
  buildConversationMessages,
  sumContentChars,
  toModelMessages,
} from './messages.js';
import { withTextModelInteraction } from './model-interaction.js';
import { ProviderAgentCache } from './provider.js';
import {
  extractGenerationResult,
  finalizeResult,
  toAsyncIterable,
} from './result.js';
import type {
  ChatMessage,
  ChatOptions,
  ConversationContext,
  MastraResult,
  MastraStreamResult,
} from './types.js';
import type { SearchRunScope } from '../../agent/common/doubao-search-tool.js';
import type { TextAgent } from '../../agent/common/text-agent.js';

export default class TextAgentService {
  private readonly agentCache = new ProviderAgentCache<TextAgent>();

  constructor(
    private readonly protocol: string,
    private readonly factory: (
      opts: ReturnType<typeof pickAgentCapabilityConfig>,
    ) => TextAgent,
  ) {}

  private getAgent(opts: ChatOptions): Promise<TextAgent> {
    const createAgent = () => this.factory(pickAgentCapabilityConfig(opts));
    if (opts.disableAgentCache) return Promise.resolve().then(createAgent);
    return this.agentCache.get(opts, createAgent);
  }

  public async stream(
    messages: ChatMessage[],
    opts: ChatOptions = {},
    abortSignal?: AbortSignal,
    scope?: SearchRunScope,
  ): Promise<MastraStreamResult> {
    abortSignal?.throwIfAborted();
    const agent = await this.getAgent(opts);
    abortSignal?.throwIfAborted();
    const modelMessagesStartedAt = performance.now();
    const modelMessages = toModelMessages(messages);
    opts.onPerformanceEvent?.('agent.model_messages.built', {
      durationMs: performance.now() - modelMessagesStartedAt,
      messageCount: messages.length,
      contentChars: sumContentChars(messages),
    });

    const streamStartedAt = performance.now();
    opts.onPerformanceEvent?.('agent.stream.invoke.started');
    const result = await agent.stream(
      modelMessages,
      buildCapabilityRunOptions(opts, abortSignal, this.protocol, scope),
    ) as MastraStreamResult;
    opts.onPerformanceEvent?.('agent.stream.invoke.completed', {
      durationMs: performance.now() - streamStartedAt,
      hasTextStream: Boolean(result.textStream),
    });
    return result;
  }

  public async streamAsAsyncIterable(
    messages: ChatMessage[],
    opts: ChatOptions = {},
    conversation?: ConversationContext,
    abortSignal?: AbortSignal,
    scope?: SearchRunScope,
  ): Promise<{
    textStream: AsyncIterable<string>;
    finalize: () => Promise<{
      text: string | undefined;
      usage: unknown;
      finishReason: unknown;
    }>;
  }> {
    const buildConversationStartedAt = performance.now();
    const preparedMessages = buildConversationMessages(messages, conversation);
    opts.onPerformanceEvent?.('agent.conversation.built', {
      durationMs: performance.now() - buildConversationStartedAt,
      inputMessageCount: messages.length,
      conversationHistoryCount: conversation?.history.length ?? 0,
      preparedMessageCount: preparedMessages.length,
      preparedContentChars: sumContentChars(preparedMessages),
    });

    return withTextModelInteraction(
      opts.onModelInteraction,
      abortSignal,
      async () => {
        const streamResult = await this.stream(
          preparedMessages,
          opts,
          abortSignal,
          scope,
        );
        return {
          textStream: toAsyncIterable(streamResult.textStream),
          finalize: () => finalizeResult(streamResult),
        };
      },
    );
  }

  public async generateRaw(
    messages: ChatMessage[],
    opts: ChatOptions = {},
    conversation?: ConversationContext,
    abortSignal?: AbortSignal,
  ): Promise<{ text: string; usage: unknown; finishReason: unknown }> {
    abortSignal?.throwIfAborted();
    const agent = await this.getAgent(opts);
    abortSignal?.throwIfAborted();
    const generate = opts.streamRawGeneration
      ? agent.stream.bind(agent)
      : agent.generate.bind(agent);
    const result = await generate(
      toModelMessages(buildConversationMessages(messages, conversation)),
      buildCapabilityRunOptions(opts, abortSignal, this.protocol),
    ) as MastraResult;
    return extractGenerationResult(result);
  }
}
