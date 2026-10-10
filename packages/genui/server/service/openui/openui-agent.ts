// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createOpenUIImageGuard } from './image-sources.js';
import { generateJevOpenUI, streamJevOpenUI } from './jev-composition.js';
import { createSearchRunScope } from '../../agent/common/doubao-search-tool.js';
import type { SearchRunScope } from '../../agent/common/doubao-search-tool.js';
import { createOpenUIAgent } from '../../agent/openui/openui-agent.js';
import type {
  OpenUIAgent,
  OpenUIAgentOptions,
} from '../../agent/openui/openui-agent.js';
import {
  buildCapabilityRunOptions,
  pickAgentCapabilityConfig,
} from '../common/agent-capabilities.js';
import { resolveJevModel } from '../common/jev-provider.js';
import {
  buildConversationMessages,
  sumContentChars,
  toModelMessages,
} from '../common/messages.js';
import { withTextModelInteraction } from '../common/model-interaction.js';
import {
  ProviderAgentCache,
  createStableValueHash,
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

export interface OpenUIChatOptions extends ChatOptions {
  promptComponentNames?: readonly string[] | undefined;
  promptOptions?: OpenUIAgentOptions['promptOptions'];
  promptRoot?: string | undefined;
  systemAppendix?: string | undefined;
}

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

  private getAgent(opts: OpenUIChatOptions): Promise<OpenUIAgent> {
    const promptVariant = opts.promptComponentNames === undefined
        && opts.promptOptions === undefined
        && opts.promptRoot === undefined
        && opts.systemAppendix === undefined
      ? undefined
      : createStableValueHash({
        appendix: opts.systemAppendix,
        componentNames: opts.promptComponentNames,
        promptOptions: opts.promptOptions,
        root: opts.promptRoot,
      });
    const createAgent = () =>
      createOpenUIAgent({
        ...pickAgentCapabilityConfig(opts),
        ...(opts.promptComponentNames === undefined
          ? {}
          : { promptComponentNames: opts.promptComponentNames }),
        ...(opts.promptOptions === undefined
          ? {}
          : { promptOptions: opts.promptOptions }),
        ...(opts.promptRoot === undefined
          ? {}
          : { promptRoot: opts.promptRoot }),
        ...(opts.systemAppendix === undefined
          ? {}
          : { systemAppendix: opts.systemAppendix }),
      }).agent;
    if (opts.disableAgentCache) return Promise.resolve().then(createAgent);
    return this.agentCache.get(
      opts,
      createAgent,
      promptVariant,
    );
  }

  public async stream(
    messages: ChatMessage[],
    opts: OpenUIChatOptions = {},
    abortSignal?: AbortSignal,
    capabilityScope?: SearchRunScope,
  ): Promise<MastraStreamResult> {
    abortSignal?.throwIfAborted();
    if (resolveJevModel(opts)) {
      const stream = streamJevOpenUI(
        messages,
        opts,
        undefined,
        abortSignal,
      );
      let result: Awaited<ReturnType<typeof stream.finalize>> | undefined;
      return {
        textStream: (async function*() {
          yield* stream.textStream;
          result = await stream.finalize();
        })(),
        get text() {
          return result?.text;
        },
        get usage() {
          return result?.usage;
        },
        get finishReason() {
          return result?.finishReason;
        },
      };
    }
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
      buildCapabilityRunOptions(opts, abortSignal, 'openui', capabilityScope),
    ) as MastraStreamResult;
    opts.onPerformanceEvent?.('agent.stream.invoke.completed', {
      durationMs: performance.now() - streamStartedAt,
      hasTextStream: Boolean(result.textStream),
    });
    return result;
  }

  public async streamAsAsyncIterable(
    messages: ChatMessage[],
    opts: OpenUIChatOptions = {},
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
    if (resolveJevModel(opts)) {
      return streamJevOpenUI(messages, opts, conversation, abortSignal);
    }
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

    return withTextModelInteraction(
      opts.onModelInteraction,
      abortSignal,
      async () => {
        const scope = createSearchRunScope();
        const streamResult = await this.stream(
          preparedMessages,
          opts,
          abortSignal,
          scope,
        );
        const safeImages = createOpenUIImageGuard(
          [
            ...messages.filter(message => message.role !== 'assistant'),
            ...(conversation?.history.filter(message => message.role === 'user')
              ?? []),
            conversation?.dataModel,
          ],
          scope,
          opts,
        );
        return {
          textStream: (async function*() {
            let text = '';
            let pending = '';
            for await (
              const chunk of toAsyncIterable(streamResult.textStream)
            ) {
              text += chunk;
              pending += chunk;
              if (
                !/\bImage\s*\(/u.test(text)
                || (chunk.includes('\n') && safeImages(text))
              ) {
                yield pending;
                pending = '';
              }
            }
            if (pending && safeImages(text)) yield pending;
          })(),
          finalize: async () => {
            const result = await finalizeResult(streamResult);
            if (result.text && !safeImages(result.text)) {
              throw new GenerationPostprocessError(
                new Error(
                  'OpenUI image source was not supplied by the user or host, or returned by an image tool. Use an Icon or text when no image is available.',
                ),
                { ...result, text: result.text },
              );
            }
            return result;
          },
        };
      },
    );
  }

  public async generateRaw(
    messages: ChatMessage[],
    opts: OpenUIChatOptions = {},
    conversation?: ConversationContext,
    abortSignal?: AbortSignal,
  ): Promise<{ text: string; usage: unknown; finishReason: unknown }> {
    abortSignal?.throwIfAborted();
    if (resolveJevModel(opts)) {
      return generateJevOpenUI(messages, opts, conversation, abortSignal);
    }
    const agent = await this.getAgent(opts);
    abortSignal?.throwIfAborted();
    const runOptions = buildCapabilityRunOptions(opts, abortSignal, 'openui');
    const result = await agent.generate(
      toModelMessages(
        buildConversationMessages(
          messages,
          conversation,
          buildDataModelSystemMessage,
        ),
      ),
      runOptions,
    ) as MastraResult;
    const extracted = await extractGenerationResult(result);
    const safeImages = createOpenUIImageGuard(
      [
        ...messages.filter(message => message.role !== 'assistant'),
        ...(conversation?.history.filter(message => message.role === 'user')
          ?? []),
        conversation?.dataModel,
      ],
      runOptions,
      opts,
    );
    if (!safeImages(extracted.text)) {
      throw new GenerationPostprocessError(
        new Error(
          'OpenUI image source was not supplied by the user or host, or returned by an image tool. Use an Icon or text when no image is available.',
        ),
        extracted,
      );
    }
    return extracted;
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
