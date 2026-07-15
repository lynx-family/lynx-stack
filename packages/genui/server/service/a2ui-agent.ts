// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createA2UIAgent } from '../agent/a2ui-agent';
import type { A2UIAgent } from '../agent/a2ui-agent';
import type { A2UICatalog } from '../agent/a2ui-catalog';
import { loadBasicCatalog } from '../agent/a2ui-catalog';
import {
  formatErrorsForModel,
  validateA2UIOutput,
} from '../agent/a2ui-validator';
import type { A2UIMessage, ValidationOptions } from '../agent/a2ui-validator';
import { resolveA2UIImageUrls } from '../agent/image-resolver';
import {
  buildConversationMessages,
  sumContentChars,
  toModelMessages,
} from './common/messages';
import {
  ProviderAgentCache,
  buildOpenAIRunOptions,
  createStableValueHash,
  pickProviderConfig,
  resolveReasoningEffort,
} from './common/provider';
import {
  extractGenerationResult,
  extractText,
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

export interface A2UIChatOptions extends ChatOptions {
  catalog?: A2UICatalog | undefined;
  maxRepairAttempts?: number | undefined;
}

export interface A2UIResponse {
  ok: boolean;
  text: string;
  messages: A2UIMessage[];
  errors: string[];
  warnings: string[];
  attempts: number;
  usage?: unknown;
  finishReason?: unknown;
}

function buildDataModelSystemMessage(
  dataModel: Record<string, unknown>,
): ChatMessage {
  return {
    role: 'system',
    content:
      `Current A2UI data model state (most recent values from prior turns):\n${
        JSON.stringify(dataModel)
      }`,
  };
}

export default class A2UIAgentService {
  private readonly agentCache = new ProviderAgentCache<A2UIAgent>();

  private async getAgent(opts: A2UIChatOptions): Promise<A2UIAgent> {
    const catalog = opts.catalog ?? await loadBasicCatalog();
    return this.agentCache.get(
      opts,
      () =>
        createA2UIAgent({
          ...pickProviderConfig(opts),
          catalog,
        }).then(({ agent }) => agent),
      `${catalog.id}:${createStableValueHash(catalog)}`,
    );
  }

  public async stream(
    messages: ChatMessage[],
    opts: A2UIChatOptions = {},
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
    opts.onPerformanceEvent?.('agent.stream.invoke.started', {
      reasoningEffort: resolveReasoningEffort(opts),
    });
    const result = agent.stream(
      modelMessages,
      buildOpenAIRunOptions(opts),
    ) as MastraStreamResult;
    opts.onPerformanceEvent?.('agent.stream.invoke.completed', {
      durationMs: performance.now() - streamStartedAt,
      hasTextStream: Boolean(result.textStream),
    });
    return result;
  }

  public async streamAsAsyncIterable(
    messages: ChatMessage[],
    opts: A2UIChatOptions = {},
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
    const streamResult: MastraStreamResult = await this.stream(
      preparedMessages,
      opts,
    );
    return {
      textStream: toAsyncIterable(streamResult.textStream),
      finalize: () => finalizeResult(streamResult),
    };
  }

  public async generate(
    messages: ChatMessage[],
    opts: A2UIChatOptions = {},
  ): Promise<unknown> {
    const agent = await this.getAgent(opts);
    return agent.generate(
      toModelMessages(messages),
      buildOpenAIRunOptions(opts),
    );
  }

  public async generateRaw(
    messages: ChatMessage[],
    opts: A2UIChatOptions = {},
    conversation?: ConversationContext,
  ): Promise<{ text: string; usage: unknown; finishReason: unknown }> {
    const result = await this.generate(
      buildConversationMessages(
        messages,
        conversation,
        buildDataModelSystemMessage,
      ),
      opts,
    ) as MastraResult;
    return extractGenerationResult(result);
  }

  public async generateValidated(
    messages: ChatMessage[],
    opts: A2UIChatOptions = {},
    conversation?: ConversationContext,
    validationOptions?: ValidationOptions,
  ): Promise<A2UIResponse> {
    const catalog = opts.catalog ?? await loadBasicCatalog();
    const maxAttempts = Math.max(1, opts.maxRepairAttempts ?? 2) + 1;
    const agent = await this.getAgent({ ...opts, catalog });

    const convo = buildConversationMessages(
      messages,
      conversation,
      buildDataModelSystemMessage,
    );

    let lastText = '';
    let lastErrors: string[] = [];
    let lastUsage: unknown;
    let lastFinishReason: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await agent.generate(
        toModelMessages(convo),
        buildOpenAIRunOptions(opts),
      ) as MastraResult;

      const text = await extractText(result);
      lastText = text;
      const metadata = await finalizeResult(result);
      lastUsage = metadata.usage;
      lastFinishReason = metadata.finishReason;

      const validation = validateA2UIOutput(text, catalog, validationOptions);
      if (validation.ok) {
        const messages = await resolveA2UIImageUrls(validation.messages);
        return {
          ok: true,
          text,
          messages,
          errors: [],
          warnings: validation.warnings,
          attempts: attempt,
          usage: lastUsage,
          finishReason: lastFinishReason,
        };
      }
      lastErrors = validation.errors;

      if (attempt < maxAttempts) {
        convo.push({ role: 'assistant', content: text });
        convo.push({
          role: 'user',
          content: formatErrorsForModel(validation.errors),
        });
      }
    }

    return {
      ok: false,
      text: lastText,
      messages: [],
      errors: lastErrors,
      warnings: [],
      attempts: maxAttempts,
      usage: lastUsage,
      finishReason: lastFinishReason,
    };
  }
}

const SERVICE_KEY = '__A2UI_AGENT_SERVICE__';
type GlobalWithService = typeof globalThis & {
  [SERVICE_KEY]?: A2UIAgentService;
};

export function getA2UIAgentService(): A2UIAgentService {
  const g = globalThis as GlobalWithService;
  g[SERVICE_KEY] ??= new A2UIAgentService();
  return g[SERVICE_KEY];
}
