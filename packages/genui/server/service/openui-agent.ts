// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createHash } from 'node:crypto';

import type {
  ChatMessage,
  ChatOptions,
  ConversationContext,
} from './a2ui-agent';
import { createOpenUIAgent } from '../agent/openui-agent';
import type { OpenUIAgent } from '../agent/openui-agent';

interface MastraResult {
  text?: unknown;
  usage?: unknown;
  finishReason?: unknown;
  response?: {
    messages?: Array<{
      content?: unknown;
    }>;
  };
}

interface MastraStreamResult extends MastraResult {
  textStream?: ReadableStream<string> | AsyncIterable<string>;
}

function isReadableStream(
  stream: ReadableStream<string> | AsyncIterable<string>,
): stream is ReadableStream<string> {
  return 'getReader' in stream && typeof stream.getReader === 'function';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function pickDefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

function hashApiKey(apiKey: string | undefined): string {
  if (!apiKey) return 'default';
  return createHash('sha256').update(apiKey).digest('hex');
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

function buildConversationMessages(
  messages: ChatMessage[],
  conversation?: ConversationContext,
): ChatMessage[] {
  return [
    ...(conversation?.history ?? []),
    ...(conversation && Object.keys(conversation.dataModel).length > 0
      ? [buildDataModelSystemMessage(conversation.dataModel)]
      : []),
    ...messages,
  ];
}

function sumContentChars(messages: ChatMessage[]): number {
  return messages.reduce((total, message) => total + message.content.length, 0);
}

async function extractText(result: MastraResult): Promise<string> {
  const direct = typeof result.text === 'string' ? result.text : undefined;
  if (direct) return direct;
  const resolved = await Promise.resolve(result.text).catch(() => undefined);
  if (typeof resolved === 'string' && resolved) return resolved;
  const messageContents = result.response?.messages ?? [];
  const textParts = messageContents
    .flatMap((m): unknown[] => (Array.isArray(m.content) ? m.content : []))
    .filter((c): c is { type: 'text'; text: string } => {
      if (!isRecord(c)) return false;
      const candidate = c as { text?: unknown; type?: unknown };
      return candidate.type === 'text' && typeof candidate.text === 'string';
    })
    .map((c) => c.text);
  return textParts.join('');
}

export default class OpenUIAgentService {
  private agentCache = new Map<string, Promise<OpenUIAgent>>();

  private getAgent(opts: ChatOptions): Promise<OpenUIAgent> {
    const startedAt = performance.now();
    const cacheKey = `${opts.baseURL ?? 'default'}:${opts.model ?? 'default'}:${
      hashApiKey(opts.apiKey)
    }:${opts.api ?? 'default'}`;
    let cached = this.agentCache.get(cacheKey);
    if (cached) {
      opts.onPerformanceEvent?.('agent.cache.hit', {
        durationMs: performance.now() - startedAt,
        cacheSize: this.agentCache.size,
      });
      return cached;
    }

    cached = Promise.resolve(
      createOpenUIAgent(pickDefined({
        apiKey: opts.apiKey,
        baseURL: opts.baseURL,
        model: opts.model,
        api: opts.api,
      })).agent,
    );
    this.agentCache.set(cacheKey, cached);
    opts.onPerformanceEvent?.('agent.cache.miss', {
      durationMs: performance.now() - startedAt,
      cacheSize: this.agentCache.size,
    });
    return cached;
  }

  private toModelMessages(messages: ChatMessage[]) {
    return messages.map((m) => ({ role: m.role, content: m.content }));
  }

  public async stream(
    messages: ChatMessage[],
    opts: ChatOptions = {},
  ): Promise<MastraStreamResult> {
    const agent = await this.getAgent(opts);
    const modelMessagesStartedAt = performance.now();
    const modelMessages = this.toModelMessages(messages);
    opts.onPerformanceEvent?.('agent.model_messages.built', {
      durationMs: performance.now() - modelMessagesStartedAt,
      messageCount: messages.length,
      contentChars: sumContentChars(messages),
    });

    const streamStartedAt = performance.now();
    opts.onPerformanceEvent?.('agent.stream.invoke.started');
    const result = agent.stream(
      modelMessages,
      pickDefined({
        resourceId: opts.resourceId,
      }),
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
    const preparedMessages = buildConversationMessages(messages, conversation);
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
    const raw = streamResult.textStream;

    const textStream: AsyncIterable<string> = {
      [Symbol.asyncIterator]: async function*() {
        if (!raw) return;
        if (isReadableStream(raw)) {
          const reader = raw.getReader();
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value) yield value;
            }
          } finally {
            reader.releaseLock();
          }
        } else {
          for await (const chunk of raw) {
            if (chunk) yield chunk;
          }
        }
      },
    };

    const finalize = async () => {
      const text = await Promise.resolve(streamResult.text).catch(
        () => undefined,
      );
      const usage = await Promise.resolve(streamResult.usage).catch(
        () => undefined,
      );
      const finishReason = await Promise.resolve(
        streamResult.finishReason,
      ).catch(() => undefined);
      return {
        text: typeof text === 'string' ? text : undefined,
        usage,
        finishReason,
      };
    };

    return { textStream, finalize };
  }

  public async generateRaw(
    messages: ChatMessage[],
    opts: ChatOptions = {},
    conversation?: ConversationContext,
  ): Promise<{ text: string; usage: unknown; finishReason: unknown }> {
    const agent = await this.getAgent(opts);
    const result = agent.generate(
      this.toModelMessages(buildConversationMessages(messages, conversation)),
      pickDefined({
        resourceId: opts.resourceId,
      }),
    ) as MastraResult;
    const text = await extractText(result);
    const usage = (await Promise.resolve(result?.usage).catch(() => undefined))
      ?? result?.usage;
    const finishReason =
      (await Promise.resolve(result?.finishReason).catch(() => undefined))
        ?? result?.finishReason;
    return { text, usage, finishReason };
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
