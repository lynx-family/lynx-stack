// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { validateLynxXml } from '@lynx-js/genui-lynx-xml';

import { createLynxXmlAgent } from '../agent/lynx-xml-agent';
import type { LynxXmlAgent } from '../agent/lynx-xml-agent';
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
import { extractGenerationResult } from './common/result';
import type {
  ChatMessage,
  ChatOptions,
  ConversationContext,
  MastraResult,
} from './common/types';

export interface LynxXmlChatOptions extends ChatOptions {
  maxRepairAttempts?: number | undefined;
}

export interface LynxXmlResponse {
  ok: boolean;
  text: string;
  errors: string[];
  attempts: number;
  usage?: unknown;
  finishReason?: unknown;
}

type LynxXmlAgentFactory = (
  opts: Parameters<typeof createLynxXmlAgent>[0],
) => LynxXmlAgent;

const MAX_REPAIR_ATTEMPTS = 2;

function resolveMaxRepairAttempts(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return MAX_REPAIR_ATTEMPTS;
  }
  return Math.min(MAX_REPAIR_ATTEMPTS, Math.max(0, Math.floor(value)));
}

function formatErrorsForModel(
  errors: string[],
  finishReason: unknown,
): string {
  const reason = typeof finishReason === 'string' && finishReason
    ? `\nThe previous finish reason was ${JSON.stringify(finishReason)}.`
    : '';
  return `The previous Lynx XML artifact failed validation:
${errors.map((error) => `- ${error}`).join('\n')}${reason}

Regenerate the entire artifact from <!DOCTYPE lynx> through the final closing </script> tag. Do not continue the truncated output and do not return a patch. Preserve the requested UI, but simplify decorative content or repeated data when necessary so the complete artifact fits in the output limit. Return only the corrected Lynx XML artifact.`;
}

export default class LynxXmlAgentService {
  private readonly agentCache = new ProviderAgentCache<LynxXmlAgent>();

  public constructor(
    private readonly agentFactory: LynxXmlAgentFactory = (opts) =>
      createLynxXmlAgent(opts).agent,
  ) {}

  private getAgent(opts: LynxXmlChatOptions): Promise<LynxXmlAgent> {
    return this.agentCache.get(
      opts,
      () => this.agentFactory(pickProviderConfig(opts)),
    );
  }

  private buildPreparedMessages(
    messages: ChatMessage[],
    opts: LynxXmlChatOptions,
    conversation?: ConversationContext,
  ): ChatMessage[] {
    const buildConversationStartedAt = performance.now();
    const preparedMessages = buildConversationMessages(
      messages,
      conversation,
    );
    opts.onPerformanceEvent?.('agent.conversation.built', {
      durationMs: performance.now() - buildConversationStartedAt,
      inputMessageCount: messages.length,
      conversationHistoryCount: conversation?.history.length ?? 0,
      preparedMessageCount: preparedMessages.length,
      preparedContentChars: sumContentChars(preparedMessages),
    });
    return preparedMessages;
  }

  private async generatePrepared(
    agent: LynxXmlAgent,
    preparedMessages: ChatMessage[],
    opts: LynxXmlChatOptions,
    abortSignal: AbortSignal | undefined,
    attempt: number,
  ): Promise<{ text: string; usage: unknown; finishReason: unknown }> {
    abortSignal?.throwIfAborted();
    const modelMessagesStartedAt = performance.now();
    const modelMessages = toModelMessages(preparedMessages);
    opts.onPerformanceEvent?.('agent.model_messages.built', {
      durationMs: performance.now() - modelMessagesStartedAt,
      messageCount: preparedMessages.length,
      contentChars: sumContentChars(preparedMessages),
      attempt,
    });

    const generationStartedAt = performance.now();
    opts.onPerformanceEvent?.('agent.generate.invoke.started', { attempt });
    const result = await agent.generate(
      modelMessages,
      buildResourceRunOptions(opts, abortSignal),
    ) as MastraResult;
    opts.onPerformanceEvent?.('agent.generate.invoke.completed', {
      durationMs: performance.now() - generationStartedAt,
      attempt,
    });
    return extractGenerationResult(result);
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
    const preparedMessages = this.buildPreparedMessages(
      messages,
      opts,
      conversation,
    );
    return this.generatePrepared(
      agent,
      preparedMessages,
      opts,
      abortSignal,
      1,
    );
  }

  public async generateValidated(
    messages: ChatMessage[],
    opts: LynxXmlChatOptions = {},
    conversation?: ConversationContext,
    abortSignal?: AbortSignal,
  ): Promise<LynxXmlResponse> {
    abortSignal?.throwIfAborted();
    const agent = await this.getAgent(opts);
    abortSignal?.throwIfAborted();
    const preparedMessages = this.buildPreparedMessages(
      messages,
      opts,
      conversation,
    );
    const maxAttempts = resolveMaxRepairAttempts(opts.maxRepairAttempts) + 1;

    let lastText = '';
    let lastErrors: string[] = ['no text produced'];
    let lastUsage: unknown;
    let lastFinishReason: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const result = await this.generatePrepared(
        agent,
        preparedMessages,
        opts,
        abortSignal,
        attempt,
      );
      lastUsage = result.usage;
      lastFinishReason = result.finishReason;

      const validation = validateLynxXml(result.text);
      lastText = validation.source;
      if (validation.ok) {
        opts.onPerformanceEvent?.('agent.validation.completed', {
          ok: true,
          attempt,
          textLength: validation.source.length,
          finishReason: result.finishReason,
        });
        return {
          ok: true,
          text: validation.source,
          errors: [],
          attempts: attempt,
          usage: lastUsage,
          finishReason: lastFinishReason,
        };
      }

      lastErrors = validation.errors;
      opts.onPerformanceEvent?.('agent.validation.completed', {
        ok: false,
        attempt,
        errors: validation.errors,
        textLength: validation.source.length,
        finishReason: result.finishReason,
      });
      if (attempt < maxAttempts) {
        opts.onPerformanceEvent?.('agent.repair.started', {
          attempt: attempt + 1,
          sourceErrors: validation.errors,
        });
        preparedMessages.push({
          role: 'assistant',
          content: validation.source,
        });
        preparedMessages.push({
          role: 'user',
          content: formatErrorsForModel(
            validation.errors,
            result.finishReason,
          ),
        });
      }
    }

    return {
      ok: false,
      text: lastText,
      errors: lastErrors,
      attempts: maxAttempts,
      usage: lastUsage,
      finishReason: lastFinishReason,
    };
  }
}

const SERVICE_KEY = '__LYNX_XML_VALIDATED_AGENT_SERVICE__';
type GlobalWithService = typeof globalThis & {
  [SERVICE_KEY]?: LynxXmlAgentService;
};

export function getLynxXmlAgentService(): LynxXmlAgentService {
  const globalService = globalThis as GlobalWithService;
  globalService[SERVICE_KEY] ??= new LynxXmlAgentService();
  return globalService[SERVICE_KEY];
}
