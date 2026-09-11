// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { compileLynxXmlFragment } from '@lynx-js/genui-lynx-xml';

import { initializeArkImageGenerationRunScope } from '../../agent/common/ark-image-generation-tool.js';
import { createSearchRunScope } from '../../agent/common/doubao-search-tool.js';
import type { SearchRunScope } from '../../agent/common/doubao-search-tool.js';
import { createLynxXmlAgent } from '../../agent/lynx-xml/lynx-xml-agent.js';
import type {
  LynxXmlAgent,
  LynxXmlFragmentOptions,
} from '../../agent/lynx-xml/lynx-xml-agent.js';
import { extractLynxXmlArtifact } from '../../agent/lynx-xml/lynx-xml-output.js';
import { pickAgentCapabilityConfig } from '../common/agent-capabilities.js';
import { createAgentStepLogger } from '../common/agent-step-logger.js';
import {
  buildConversationMessages,
  sumContentChars,
  toModelMessages,
} from '../common/messages.js';
import {
  ProviderAgentCache,
  buildOpenAIRunOptions,
  resolveModelOutputTokenBudget,
} from '../common/provider.js';
import {
  GenerationPostprocessError,
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

export interface LynxXmlChatOptions
  extends ChatOptions, LynxXmlFragmentOptions
{}

export interface LynxXmlGenerationMetadata extends Record<string, unknown> {
  modelOutput: string;
  xmlFragment?: string;
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
  const runOptions = buildOpenAIRunOptions(opts, abortSignal);
  return {
    ...runOptions,
    modelSettings: { ...runOptions.modelSettings, maxOutputTokens },
  };
}

/** Add shared capability budgets and diagnostics to one agent invocation. */
function buildLynxXmlScopedRunOptions(
  opts: LynxXmlChatOptions,
  abortSignal: AbortSignal | undefined,
  scope: SearchRunScope,
) {
  initializeArkImageGenerationRunScope(scope);
  return {
    ...buildLynxXmlRunOptions(opts, abortSignal),
    ...createAgentStepLogger(opts, 'lynx-xml', {
      enableHtmlFragment: opts.enableHtmlFragment === true,
    }),
    requestContext: scope.requestContext,
  };
}

/** Track streamed text so final fragment compilation has a fallback value. */
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

function compileGeneration(
  result: { text: string; usage: unknown; finishReason: unknown },
  opts: LynxXmlChatOptions,
): { text: string; metadata: LynxXmlGenerationMetadata } {
  try {
    const compiled = opts.enableHtmlFragment === true
      ? compileLynxXmlFragment(extractLynxXmlArtifact(result.text))
      : { text: result.text };
    return {
      text: compiled.text,
      metadata: {
        ...('xmlFragment' in compiled
          ? { xmlFragment: compiled.xmlFragment }
          : {}),
        modelOutput: result.text,
      },
    };
  } catch (error) {
    throw new GenerationPostprocessError(error, result);
  }
}

export default class LynxXmlAgentService {
  private readonly agentCache = new ProviderAgentCache<LynxXmlAgent>();

  private getAgent(opts: LynxXmlChatOptions): Promise<LynxXmlAgent> {
    const createAgent = () =>
      createLynxXmlAgent({
        ...pickAgentCapabilityConfig(opts),
        enableHtmlFragment: opts.enableHtmlFragment,
      }).agent;
    if (opts.disableAgentCache) return Promise.resolve().then(createAgent);
    return this.agentCache.get(
      opts,
      createAgent,
      opts.enableHtmlFragment === true
        ? 'html-fragment-enabled'
        : 'html-fragment-disabled',
    );
  }

  private async streamWithScope(
    messages: ChatMessage[],
    opts: LynxXmlChatOptions,
    abortSignal: AbortSignal | undefined,
    scope: SearchRunScope,
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
      createSearchRunScope(),
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
      metadata: LynxXmlGenerationMetadata;
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

    const scope = createSearchRunScope();
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
          ...compileGeneration({ ...result, text: rawText }, opts),
        };
      },
    };
  }

  public async generateRaw(
    messages: ChatMessage[],
    opts: LynxXmlChatOptions = {},
    conversation?: ConversationContext,
    abortSignal?: AbortSignal,
  ): Promise<{
    text: string;
    usage: unknown;
    finishReason: unknown;
    metadata: LynxXmlGenerationMetadata;
  }> {
    abortSignal?.throwIfAborted();
    const agent = await this.getAgent(opts);
    abortSignal?.throwIfAborted();
    const scope = createSearchRunScope();
    const result = await agent.generate(
      toModelMessages(buildConversationMessages(messages, conversation)),
      buildLynxXmlScopedRunOptions(opts, abortSignal, scope),
    ) as MastraResult;
    const generated = await extractGenerationResult(result);
    return {
      ...generated,
      ...compileGeneration(generated, opts),
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
