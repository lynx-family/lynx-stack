// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createOpenUIAgent } from '../agent/openui-agent';
import type { OpenUIAgent } from '../agent/openui-agent';
import {
  buildConversationMessages,
  sumContentChars,
  toModelMessages,
} from './common/messages';
import {
  ProviderAgentCache,
  buildResourceRunOptions,
  pickProviderConfig,
} from './common/provider';
import {
  extractGenerationResult,
  finalizeResult,
  toAsyncIterable,
} from './common/result';
import type {
  ChatMessage,
  ChatOptions,
  ConversationContext,
  MastraResult,
  MastraStreamResult,
} from './common/types';

function buildDataModelSystemMessage(
  dataModel: Record<string, unknown>,
): ChatMessage {
  return {
    role: 'system',
    content: `Current OpenUI state (most recent values from prior turns):\n${
      JSON.stringify(dataModel)
    }`,
  };
}

export default class OpenUIAgentService {
  private readonly agentCache = new ProviderAgentCache<OpenUIAgent>();

  private getAgent(opts: ChatOptions): Promise<OpenUIAgent> {
    return this.agentCache.get(
      opts,
      () => createOpenUIAgent(pickProviderConfig(opts)).agent,
    );
  }

  public async stream(
    messages: ChatMessage[],
    opts: ChatOptions = {},
  ): Promise<MastraStreamResult> {
    const agent = await this.getAgent(opts);
    const modelMessagesStartedAt = performance.now();
    const modelMessages = toModelMessages(messages);
    opts.onPerformanceEvent?.('agent.model_messages.built', {
      durationMs: performance.now() - modelMessagesStartedAt,
      messageCount: messages.length,
      contentChars: sumContentChars(messages),
    });

    const streamStartedAt = performance.now();
    opts.onPerformanceEvent?.('agent.stream.invoke.started');
    const result = agent.stream(
      modelMessages,
      buildResourceRunOptions(opts),
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
  ): Promise<{
    textStream: AsyncIterable<string>;
    finalize: () => Promise<{
      text: string | undefined;
      usage: unknown;
      finishReason: unknown;
    }>;
  }> {
    const buildConversationStartedAt = performance.now();
    const preparedMessages = buildConversationMessages(
      messages,
      conversation,
      buildDataModelSystemMessage,
    );
    opts.onPerformanceEvent?.('agent.conversation.built', {
      durationMs: performance.now() - buildConversationStartedAt,
      inputMessageCount: messages.length,
      conversationHistoryCount: conversation?.history.length ?? 0,
      dataModelKeyCount: conversation
        ? Object.keys(conversation.dataModel).length
        : 0,
      preparedMessageCount: preparedMessages.length,
      preparedContentChars: sumContentChars(preparedMessages),
    });

    const streamResult = await this.stream(preparedMessages, opts);
    return {
      textStream: toAsyncIterable(streamResult.textStream),
      finalize: () => finalizeResult(streamResult),
    };
  }

  public async generateRaw(
    messages: ChatMessage[],
    opts: ChatOptions = {},
    conversation?: ConversationContext,
  ): Promise<{ text: string; usage: unknown; finishReason: unknown }> {
    const agent = await this.getAgent(opts);
    const result = agent.generate(
      toModelMessages(
        buildConversationMessages(
          messages,
          conversation,
          buildDataModelSystemMessage,
        ),
      ),
      buildResourceRunOptions(opts),
    ) as MastraResult;
    return extractGenerationResult(result);
  }
}

const SERVICE_KEY = '__OPENUI_AGENT_SERVICE__';
type GlobalWithService = typeof globalThis & {
  [SERVICE_KEY]?: OpenUIAgentService;
};

export function getOpenUIAgentService(): OpenUIAgentService {
  const g = globalThis as GlobalWithService;
  g[SERVICE_KEY] ??= new OpenUIAgentService();
  return g[SERVICE_KEY];
}
