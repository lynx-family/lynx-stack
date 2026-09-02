// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  createHtmlFragmentScriptRunScope,
  resolveHtmlFragmentScriptPlaceholders,
} from '../agent/html-fragment-to-main-thread-script-tool.js';
import type { HtmlFragmentScriptRunScope } from '../agent/html-fragment-to-main-thread-script-tool.js';
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
  resolveModelOutputTokenBudget,
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

export const LYNX_XML_MAX_OUTPUT_TOKENS = 16_384;

export function buildLynxXmlRunOptions(
  opts: LynxXmlChatOptions,
  abortSignal?: AbortSignal,
) {
  const maxOutputTokens = resolveModelOutputTokenBudget(
    opts,
    LYNX_XML_MAX_OUTPUT_TOKENS,
  );
  return {
    ...buildResourceRunOptions(opts, abortSignal),
    modelSettings: { maxOutputTokens },
  };
}

/** Add the request-scoped fragment registry to one agent invocation. */
function buildLynxXmlScopedRunOptions(
  opts: LynxXmlChatOptions,
  abortSignal: AbortSignal | undefined,
  scope: HtmlFragmentScriptRunScope,
) {
  return {
    ...buildLynxXmlRunOptions(opts, abortSignal),
    requestContext: scope.requestContext,
  };
}

/** Track streamed text so final placeholder expansion has a fallback value. */
function trackTextStream(
  source: AsyncIterable<string>,
  onChunk: (chunk: string) => void,
): AsyncIterable<string> {
  return {
    [Symbol.asyncIterator]: async function*() {
      for await (const chunk of source) {
        onChunk(chunk);
        yield chunk;
      }
    },
  };
}

export default class LynxXmlAgentService {
  private readonly agentCache = new ProviderAgentCache<LynxXmlAgent>();

  private getAgent(opts: LynxXmlChatOptions): Promise<LynxXmlAgent> {
    const createAgent = () =>
      createLynxXmlAgent(pickProviderConfig(opts)).agent;
    if (opts.disableAgentCache) return Promise.resolve().then(createAgent);
    return this.agentCache.get(opts, createAgent);
  }

  private async streamWithScope(
    messages: ChatMessage[],
    opts: LynxXmlChatOptions,
    abortSignal: AbortSignal | undefined,
    scope: HtmlFragmentScriptRunScope,
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
    const runOptions = buildLynxXmlScopedRunOptions(
      opts,
      abortSignal,
      scope,
    );
    opts.onPerformanceEvent?.('agent.stream.invoke.started', {
      maxOutputTokens: runOptions.modelSettings.maxOutputTokens,
    });
    const result = await agent.stream(
      modelMessages,
      runOptions,
    ) as MastraStreamResult;
    opts.onPerformanceEvent?.('agent.stream.invoke.completed', {
      durationMs: performance.now() - streamStartedAt,
      hasTextStream: Boolean(result.textStream),
    });
    return result;
  }

  public stream(
    messages: ChatMessage[],
    opts: LynxXmlChatOptions = {},
    abortSignal?: AbortSignal,
  ): Promise<MastraStreamResult> {
    return this.streamWithScope(
      messages,
      opts,
      abortSignal,
      createHtmlFragmentScriptRunScope(),
    );
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

    const scope = createHtmlFragmentScriptRunScope();
    const streamResult = await this.streamWithScope(
      preparedMessages,
      opts,
      abortSignal,
      scope,
    );
    let streamedText = '';
    return {
      textStream: trackTextStream(
        toAsyncIterable(streamResult.textStream),
        (chunk) => {
          streamedText += chunk;
        },
      ),
      finalize: async () => {
        const result = await finalizeResult(streamResult);
        const rawText = result.text ?? streamedText;
        return {
          ...result,
          text: resolveHtmlFragmentScriptPlaceholders(scope, rawText),
        };
      },
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
    const scope = createHtmlFragmentScriptRunScope();
    const result = await agent.generate(
      toModelMessages(buildConversationMessages(messages, conversation)),
      buildLynxXmlScopedRunOptions(opts, abortSignal, scope),
    ) as MastraResult;
    const generated = await extractGenerationResult(result);
    return {
      ...generated,
      text: resolveHtmlFragmentScriptPlaceholders(scope, generated.text),
    };
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
