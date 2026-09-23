// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { assembleLynxXmlArtifact } from '@lynx-js/genui-lynx-xml';

import { initializeArkImageGenerationRunScope } from '../../agent/common/ark-image-generation-tool.js';
import { createSearchRunScope } from '../../agent/common/doubao-search-tool.js';
import type { SearchRunScope } from '../../agent/common/doubao-search-tool.js';
import { registerToolPerformanceObserver } from '../../agent/common/tool-performance.js';
import { createLynxXmlAgent } from '../../agent/lynx-xml/lynx-xml-agent.js';
import type {
  LynxXmlAgent,
  LynxXmlFragmentOptions,
} from '../../agent/lynx-xml/lynx-xml-agent.js';
import {
  extractLynxXmlArtifact,
  normalizeLynxXmlArtifact,
} from '../../agent/lynx-xml/lynx-xml-output.js';
import { pickAgentCapabilityConfig } from '../common/agent-capabilities.js';
import { createAgentStepLogger } from '../common/agent-step-logger.js';
import {
  buildConversationMessages,
  sumContentChars,
  toModelMessages,
} from '../common/messages.js';
import { withTextModelInteraction } from '../common/model-interaction.js';
import {
  ProviderAgentCache,
  buildOpenAIRunOptions,
  resolveModelOutputTokenBudget,
  resolveReasoningRecoverySettings,
} from '../common/provider.js';
import {
  GenerationPostprocessError,
  extractGenerationResult,
} from '../common/result.js';
import { recoverTextGeneration } from '../common/text-generation-recovery.js';
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

const LYNX_XML_MAX_GENERATION_ATTEMPTS = 1;

/** Initialize capability budgets once for all attempts in one request. */
function createLynxXmlRunScope(): SearchRunScope {
  const scope = createSearchRunScope();
  initializeArkImageGenerationRunScope(scope);
  return scope;
}

/** Add shared capability budgets and diagnostics to one agent invocation. */
function buildLynxXmlScopedRunOptions(
  opts: LynxXmlChatOptions,
  abortSignal: AbortSignal | undefined,
  scope: SearchRunScope,
  maxOutputTokens?: number,
) {
  registerToolPerformanceObserver(scope, opts.onPerformanceEvent);
  return {
    ...buildOpenAIRunOptions(opts, abortSignal, maxOutputTokens),
    ...createAgentStepLogger(opts, 'lynx-xml', {
      enableHtmlFragment: opts.enableHtmlFragment === true,
      enableScriptReuse: opts.enableScriptReuse === true,
      enableStylePreset: opts.stylePreset === 'default',
    }),
    requestContext: scope.requestContext,
  };
}

function compileGeneration(
  result: { text: string; usage: unknown; finishReason: unknown },
  opts: LynxXmlChatOptions,
): { text: string; metadata: LynxXmlGenerationMetadata } {
  try {
    const startedAt = performance.now();
    const compiled =
      opts.enableHtmlFragment === true || opts.enableScriptReuse === true
        || opts.stylePreset
        ? assembleLynxXmlArtifact(extractLynxXmlArtifact(result.text), {
          enableHtmlFragment: opts.enableHtmlFragment === true,
          enableScriptReuse: opts.enableScriptReuse === true,
          stylePreset: opts.stylePreset ?? false,
        })
        : { text: result.text };
    opts.onPerformanceEvent?.('agent.artifact.assembled', {
      durationMs: performance.now() - startedAt,
      modelOutputChars: result.text.length,
      artifactChars: compiled.text.length,
      enableScriptReuse: opts.enableScriptReuse === true,
    });
    return {
      text: compiled.text,
      metadata: {
        ...('xmlFragment' in compiled
          ? { xmlFragment: compiled.xmlFragment }
          : {}),
        modelOutput: result.text,
        ...(opts.enableScriptReuse ? { enableScriptReuse: true } : {}),
        ...(opts.stylePreset ? { stylePreset: opts.stylePreset } : {}),
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
        enableScriptReuse: opts.enableScriptReuse,
        stylePreset: opts.stylePreset,
        enableDesignGuidance: opts.enableDesignGuidance,
      }).agent;
    if (opts.disableAgentCache) return Promise.resolve().then(createAgent);
    return this.agentCache.get(
      opts,
      createAgent,
      (opts.enableHtmlFragment === true
        ? 'html-fragment-enabled'
        : 'html-fragment-disabled')
        + `:style-${opts.stylePreset === 'default' ? 'default' : 'off'}`
        + `:script-${opts.enableScriptReuse === true ? 'on' : 'off'}`,
    );
  }

  private async streamWithScope(
    messages: ChatMessage[],
    opts: LynxXmlChatOptions,
    abortSignal: AbortSignal | undefined,
    scope: SearchRunScope,
    maxOutputTokens?: number,
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
      maxOutputTokens,
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
      createLynxXmlRunScope(),
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

    const scope = createLynxXmlRunScope();
    const maxOutputTokens = resolveModelOutputTokenBudget(opts);
    const retrySettings = resolveReasoningRecoverySettings(
      opts,
      maxOutputTokens,
    );
    return withTextModelInteraction(
      opts.onModelInteraction,
      abortSignal,
      async () => {
        const streamResult = await this.streamWithScope(
          preparedMessages,
          opts,
          abortSignal,
          scope,
        );
        return recoverTextGeneration({
          initialMessages: preparedMessages,
          initialResult: streamResult,
          maxAttempts: LYNX_XML_MAX_GENERATION_ATTEMPTS,
          reasoningRecovery: retrySettings
            ? { maxOutputTokens, retrySettings }
            : undefined,
          stream: (nextMessages, settings) =>
            this.streamWithScope(
              nextMessages,
              settings
                ? { ...opts, reasoningEffort: settings.reasoningEffort }
                : opts,
              abortSignal,
              scope,
              settings?.maxOutputTokens,
            ),
          postprocess: result => {
            const artifact = compileGeneration(result, opts);
            return {
              ...artifact,
              text: normalizeLynxXmlArtifact(artifact.text),
            };
          },
          canContinue: text =>
            /<lynx\b/u.test(text) && !text.includes('</lynx>'),
          abortSignal,
          onPerformanceEvent: opts.onPerformanceEvent,
        });
      },
    );
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
    const scope = createLynxXmlRunScope();
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
