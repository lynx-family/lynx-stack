// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createA2UIAgent } from '../agent/a2ui-agent';
import type { A2UIAgent } from '../agent/a2ui-agent';
import type { A2UICatalog } from '../agent/a2ui-catalog';
import { loadBasicCatalog } from '../agent/a2ui-catalog';
import { createA2UIImageSourcePolicy } from '../agent/a2ui-image-source-policy.js';
import {
  createA2UIOpenURLPolicy,
  userProvidedA2UIURLSources,
} from '../agent/a2ui-open-url-policy.js';
import {
  extractJsonArray,
  formatErrorsForModel,
  validateA2UIOutput,
} from '../agent/a2ui-validator';
import type { A2UIMessage, ValidationOptions } from '../agent/a2ui-validator';
import type { ArkImageGenerationRunScope } from '../agent/ark-image-generation-tool.js';
import {
  createArkImageGenerationRunScope,
  generatedArkImageURLs,
  waitForPendingArkImageGeneration,
} from '../agent/ark-image-generation-tool.js';
import {
  searchedDoubaoDocumentURLs,
  searchedDoubaoImageURLs,
} from '../agent/doubao-search-tool.js';
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
  extractSuspension,
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
  /** Disable non-deterministic web and image search for controlled runs. */
  enableWebSearch?: boolean | undefined;
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

function buildA2UIRunOptions(
  opts: A2UIChatOptions,
  abortSignal: AbortSignal | undefined,
  imageGenerationScope: ArkImageGenerationRunScope,
) {
  return {
    ...buildOpenAIRunOptions(opts, abortSignal),
    requestContext: imageGenerationScope.requestContext,
  };
}

interface CompletedA2UIRun {
  text: string;
  usage: unknown;
  finishReason: unknown;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function canonicalA2UIText(phaseTexts: readonly string[]): string {
  const messages: unknown[] = [];
  for (const text of phaseTexts) {
    if (!text.trim()) continue;
    const parsed = extractJsonArray(text);
    if (!isUnknownArray(parsed)) return phaseTexts.join('\n');
    messages.push(...parsed);
  }
  return messages.length > 0
    ? JSON.stringify(messages, null, 2)
    : phaseTexts.join('\n');
}

function isSuspended(finishReason: unknown): boolean {
  return finishReason === 'suspended';
}

export default class A2UIAgentService {
  private readonly agentCache = new ProviderAgentCache<A2UIAgent>();

  private async getAgent(opts: A2UIChatOptions): Promise<A2UIAgent> {
    const catalog = opts.catalog ?? await loadBasicCatalog();
    const createAgent = () =>
      createA2UIAgent({
        ...pickProviderConfig(opts),
        catalog,
        enableWebSearch: opts.enableWebSearch,
      }).then(({ agent }) => agent);
    if (opts.disableAgentCache) return createAgent();
    return this.agentCache.get(
      opts,
      createAgent,
      `${catalog.id}:${
        createStableValueHash({
          catalog,
          enableWebSearch: opts.enableWebSearch,
        })
      }`,
    );
  }

  private async startStream(
    messages: ChatMessage[],
    opts: A2UIChatOptions,
    abortSignal: AbortSignal | undefined,
    imageGenerationScope: ArkImageGenerationRunScope,
  ): Promise<{ agent: A2UIAgent; result: MastraStreamResult }> {
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
    opts.onPerformanceEvent?.('agent.stream.invoke.started', {
      reasoningEffort: resolveReasoningEffort(opts),
    });
    const result = await agent.stream(
      modelMessages,
      buildA2UIRunOptions(opts, abortSignal, imageGenerationScope),
    ) as MastraStreamResult;
    opts.onPerformanceEvent?.('agent.stream.invoke.completed', {
      durationMs: performance.now() - streamStartedAt,
      hasTextStream: Boolean(result.textStream),
    });
    return { agent, result };
  }

  public async stream(
    messages: ChatMessage[],
    opts: A2UIChatOptions = {},
    abortSignal?: AbortSignal,
    imageGenerationScope = createArkImageGenerationRunScope(),
  ): Promise<MastraStreamResult> {
    const started = await this.startStream(
      messages,
      opts,
      abortSignal,
      imageGenerationScope,
    );
    return started.result;
  }

  public async streamAsAsyncIterable(
    messages: ChatMessage[],
    opts: A2UIChatOptions = {},
    conversation?: ConversationContext,
    abortSignal?: AbortSignal,
    imageGenerationScope = createArkImageGenerationRunScope(),
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
    const started = await this.startStream(
      preparedMessages,
      opts,
      abortSignal,
      imageGenerationScope,
    );
    let resolveFinal!: (value: CompletedA2UIRun) => void;
    let rejectFinal!: (reason?: unknown) => void;
    const finalResult = new Promise<CompletedA2UIRun>((resolve, reject) => {
      resolveFinal = resolve;
      rejectFinal = reject;
    });
    void finalResult.catch(() => undefined);
    let consumed = false;
    let finalSettled = false;

    return {
      textStream: {
        [Symbol.asyncIterator]: async function*() {
          if (consumed) {
            throw new Error('A2UI agent stream can only be consumed once');
          }
          consumed = true;
          const phaseTexts: string[] = [];
          let result = started.result;

          try {
            while (true) {
              let streamedPhaseText = '';
              for await (const chunk of toAsyncIterable(result.textStream)) {
                streamedPhaseText += chunk;
                yield chunk;
              }

              const metadata = await finalizeResult(result);
              const phaseText = streamedPhaseText.trim()
                ? streamedPhaseText
                : metadata.text ?? await extractText(result);
              if (phaseText) phaseTexts.push(phaseText);
              if (!isSuspended(metadata.finishReason)) {
                const completed = {
                  text: canonicalA2UIText(phaseTexts),
                  usage: metadata.usage,
                  finishReason: metadata.finishReason,
                };
                finalSettled = true;
                resolveFinal(completed);
                return;
              }

              const suspended = await extractSuspension(result);
              if (!suspended.runId) {
                throw new Error(
                  'Suspended image generation did not provide an agent runId',
                );
              }
              opts.onPerformanceEvent?.('image_generation.suspended', {
                runId: suspended.runId,
              });
              const waitStartedAt = performance.now();
              const resumeData = await waitForPendingArkImageGeneration(
                imageGenerationScope,
                suspended.suspendPayload,
              );
              abortSignal?.throwIfAborted();
              opts.onPerformanceEvent?.('image_generation.completed', {
                durationMs: performance.now() - waitStartedAt,
                ok: resumeData.ok,
              });

              yield '\n';
              const resumeStartedAt = performance.now();
              result = await started.agent.resumeStream(
                resumeData,
                {
                  ...buildA2UIRunOptions(
                    opts,
                    abortSignal,
                    imageGenerationScope,
                  ),
                  runId: suspended.runId,
                  ...(suspended.toolCallId
                    ? { toolCallId: suspended.toolCallId }
                    : {}),
                },
              ) as MastraStreamResult;
              opts.onPerformanceEvent?.('agent.stream.resume.completed', {
                durationMs: performance.now() - resumeStartedAt,
                hasTextStream: Boolean(result.textStream),
              });
            }
          } catch (error) {
            finalSettled = true;
            rejectFinal(error);
            throw error;
          } finally {
            if (!finalSettled) {
              finalSettled = true;
              rejectFinal(
                new Error('A2UI agent stream ended before completion'),
              );
            }
          }
        },
      },
      finalize: () => finalResult,
    };
  }

  public async generate(
    messages: ChatMessage[],
    opts: A2UIChatOptions = {},
    abortSignal?: AbortSignal,
    imageGenerationScope = createArkImageGenerationRunScope(),
  ): Promise<unknown> {
    abortSignal?.throwIfAborted();
    const agent = await this.getAgent(opts);
    abortSignal?.throwIfAborted();
    return agent.generate(
      toModelMessages(messages),
      buildA2UIRunOptions(opts, abortSignal, imageGenerationScope),
    );
  }

  private async generateToCompletion(
    agent: A2UIAgent,
    modelMessages: unknown,
    opts: A2UIChatOptions,
    abortSignal: AbortSignal | undefined,
    imageGenerationScope: ArkImageGenerationRunScope,
  ): Promise<CompletedA2UIRun> {
    abortSignal?.throwIfAborted();
    let result = await agent.generate(
      modelMessages,
      buildA2UIRunOptions(opts, abortSignal, imageGenerationScope),
    ) as MastraResult;
    const phaseTexts: string[] = [];

    while (true) {
      const [text, metadata] = await Promise.all([
        extractText(result),
        finalizeResult(result),
      ]);
      if (text) phaseTexts.push(text);
      abortSignal?.throwIfAborted();
      if (!isSuspended(metadata.finishReason)) {
        return {
          text: canonicalA2UIText(phaseTexts),
          usage: metadata.usage,
          finishReason: metadata.finishReason,
        };
      }

      const suspended = await extractSuspension(result);
      if (!suspended.runId) {
        throw new Error(
          'Suspended image generation did not provide an agent runId',
        );
      }
      opts.onPerformanceEvent?.('image_generation.suspended', {
        runId: suspended.runId,
      });
      const waitStartedAt = performance.now();
      const resumeData = await waitForPendingArkImageGeneration(
        imageGenerationScope,
        suspended.suspendPayload,
      );
      abortSignal?.throwIfAborted();
      opts.onPerformanceEvent?.('image_generation.completed', {
        durationMs: performance.now() - waitStartedAt,
        ok: resumeData.ok,
      });
      result = await agent.resumeGenerate(
        resumeData,
        {
          ...buildA2UIRunOptions(opts, abortSignal, imageGenerationScope),
          runId: suspended.runId,
          ...(suspended.toolCallId
            ? { toolCallId: suspended.toolCallId }
            : {}),
        },
      ) as MastraResult;
    }
  }

  public async generateRaw(
    messages: ChatMessage[],
    opts: A2UIChatOptions = {},
    conversation?: ConversationContext,
    abortSignal?: AbortSignal,
    imageGenerationScope = createArkImageGenerationRunScope(),
  ): Promise<{ text: string; usage: unknown; finishReason: unknown }> {
    abortSignal?.throwIfAborted();
    const agent = await this.getAgent(opts);
    abortSignal?.throwIfAborted();
    return this.generateToCompletion(
      agent,
      toModelMessages(buildConversationMessages(
        messages,
        conversation,
        buildDataModelSystemMessage,
      )),
      opts,
      abortSignal,
      imageGenerationScope,
    );
  }

  public async generateValidated(
    messages: ChatMessage[],
    opts: A2UIChatOptions = {},
    conversation?: ConversationContext,
    validationOptions?: ValidationOptions,
    abortSignal?: AbortSignal,
    imageGenerationScope = createArkImageGenerationRunScope(),
  ): Promise<A2UIResponse> {
    abortSignal?.throwIfAborted();
    const catalog = opts.catalog ?? await loadBasicCatalog();
    const maxAttempts = Math.max(1, opts.maxRepairAttempts ?? 2) + 1;
    const agent = await this.getAgent({ ...opts, catalog });
    abortSignal?.throwIfAborted();

    const convo = buildConversationMessages(
      messages,
      conversation,
      buildDataModelSystemMessage,
    );
    const trustedImageSource = createA2UIImageSourcePolicy(
      [
        messages,
        conversation,
        catalog,
        validationOptions?.existingDataModelBySurface,
      ],
      () => [
        ...generatedArkImageURLs(imageGenerationScope),
        ...searchedDoubaoImageURLs(imageGenerationScope),
      ],
    );
    const callerImageSourcePolicy = validationOptions?.isImageSourceAllowed;
    const isImageSourceAllowed = callerImageSourcePolicy
      ? (source: string) =>
        callerImageSourcePolicy(source) || trustedImageSource(source)
      : trustedImageSource;
    const trustedOpenURL = createA2UIOpenURLPolicy(
      userProvidedA2UIURLSources(
        messages,
        conversation?.history,
      ),
      () => searchedDoubaoDocumentURLs(imageGenerationScope),
    );
    const callerOpenURLPolicy = validationOptions?.isOpenUrlAllowed;
    const isOpenUrlAllowed = callerOpenURLPolicy
      ? (source: string) =>
        callerOpenURLPolicy(source) || trustedOpenURL(source)
      : trustedOpenURL;
    const effectiveValidationOptions: ValidationOptions = {
      ...validationOptions,
      isImageSourceAllowed,
      isOpenUrlAllowed,
    };

    let lastText = '';
    let lastErrors: string[] = [];
    let lastUsage: unknown;
    let lastFinishReason: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      abortSignal?.throwIfAborted();
      const completed = await this.generateToCompletion(
        agent,
        toModelMessages(convo),
        opts,
        abortSignal,
        imageGenerationScope,
      );

      const { text } = completed;
      lastText = text;
      lastUsage = completed.usage;
      lastFinishReason = completed.finishReason;
      abortSignal?.throwIfAborted();

      const validation = validateA2UIOutput(
        text,
        catalog,
        effectiveValidationOptions,
      );
      if (validation.ok) {
        abortSignal?.throwIfAborted();
        return {
          ok: true,
          text,
          messages: validation.messages,
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
