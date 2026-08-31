// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createLynxXmlAgent } from '../agent/lynx-xml-agent.js';
import type { LynxXmlAgent } from '../agent/lynx-xml-agent.js';
import {
  buildConversationMessages,
  sumContentChars,
  toModelMessages,
} from './common/messages.js';
import {
  ProviderAgentCache,
  buildResourceRunOptions,
  pickProviderConfig,
} from './common/provider.js';
import {
  extractGenerationResult,
  finalizeResult,
  toAsyncIterable,
} from './common/result.js';
import type {
  ChatMessage,
  ChatOptions,
  ConversationContext,
  MastraResult,
  MastraStreamResult,
} from './common/types.js';

export interface LynxXmlChatOptions extends ChatOptions {
  /** Do not retain request-scoped provider credentials in the shared cache. */
  disableAgentCache?: boolean | undefined;
}

export default class LynxXmlAgentService {
  private readonly agentCache = new ProviderAgentCache<LynxXmlAgent>();

  private getAgent(opts: LynxXmlChatOptions): Promise<LynxXmlAgent> {
    const createAgent = () =>
      createLynxXmlAgent(pickProviderConfig(opts)).agent;
    if (opts.disableAgentCache) return Promise.resolve().then(createAgent);
    return this.agentCache.get(opts, createAgent);
  }

  public async stream(
    messages: ChatMessage[],
    opts: LynxXmlChatOptions = {},
    abortSignal?: AbortSignal,
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
      buildResourceRunOptions(opts, abortSignal),
    ) as MastraStreamResult;
    opts.onPerformanceEvent?.('agent.stream.invoke.completed', {
      durationMs: performance.now() - streamStartedAt,
      hasTextStream: Boolean(result.textStream),
    });
    return result;
  }

  public async streamAsAsyncIterable(
    messages: ChatMessage[],
    opts: LynxXmlChatOptions = {},
    conversation?: ConversationContext,
    abortSignal?: AbortSignal,
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

    const streamResult = await this.stream(
      preparedMessages,
      opts,
      abortSignal,
    );
    return {
      textStream: toAsyncIterable(streamResult.textStream),
      finalize: () => finalizeResult(streamResult),
    };
  }

  public async generateRaw(
    messages: ChatMessage[],
    opts: LynxXmlChatOptions = {},
    conversation?: ConversationContext,
    abortSignal?: AbortSignal,
  ): Promise<{ text: string; usage: unknown; finishReason: unknown }> {
    abortSignal?.throwIfAborted();
    const agent = await this.getAgent(opts);
    abortSignal?.throwIfAborted();
    const result = await agent.generate(
      toModelMessages(buildConversationMessages(messages, conversation)),
      buildResourceRunOptions(opts, abortSignal),
    ) as MastraResult;
    return extractGenerationResult(result);
  }
}

const SERVICE_KEY = '__LYNX_XML_AGENT_SERVICE__';
type GlobalWithService = typeof globalThis & {
  [SERVICE_KEY]?: LynxXmlAgentService;
};

export function getLynxXmlAgentService(): LynxXmlAgentService {
  const global = globalThis as GlobalWithService;
  global[SERVICE_KEY] ??= new LynxXmlAgentService();
  return global[SERVICE_KEY];
}
