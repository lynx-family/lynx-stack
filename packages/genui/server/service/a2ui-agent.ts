// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createHash } from 'node:crypto';

import { createA2UIAgent } from '../agent/a2ui-agent';
import type { A2UIAgent } from '../agent/a2ui-agent';
import { BASIC_CATALOG } from '../agent/a2ui-catalog';
import type { A2UICatalog } from '../agent/a2ui-catalog';
import {
  formatErrorsForModel,
  validateA2UIOutput,
} from '../agent/a2ui-validator';
import type { A2UIMessage } from '../agent/a2ui-validator';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatOptions {
  threadId?: string | undefined;
  resourceId?: string | undefined;
  apiKey?: string | undefined;
  baseURL?: string | undefined;
  model?: string | undefined;
  catalog?: A2UICatalog | undefined;
  maxRepairAttempts?: number | undefined;
}

export interface A2UIResponse {
  ok: boolean;
  text: string;
  messages: A2UIMessage[];
  errors: string[];
  attempts: number;
  usage?: unknown;
  finishReason?: unknown;
}

interface ConversationMemory {
  history: ChatMessage[];
  surfaceIds: Set<string>;
  dataModel: Record<string, unknown>;
  lastSeenAt: number;
}

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

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
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
  private agentCache = new Map<string, Promise<A2UIAgent>>();

  private conversations = new Map<string, ConversationMemory>();

  private readonly maxThreads: number = parsePositiveInt(
    process.env.A2UI_MAX_THREADS,
    500,
  );

  private readonly threadTtlMs: number = parsePositiveInt(
    process.env.A2UI_THREAD_TTL_MS,
    30 * 60_000,
  );

  private lastSweepAt = 0;

  private sweepConversations(now: number): void {
    if (now - this.lastSweepAt < 60_000) return;
    this.lastSweepAt = now;

    for (const [key, value] of this.conversations) {
      if (now - value.lastSeenAt > this.threadTtlMs) {
        this.conversations.delete(key);
      }
    }

    if (this.conversations.size > this.maxThreads) {
      const overflow = this.conversations.size - this.maxThreads;
      const iter = this.conversations.keys();
      for (let i = 0; i < overflow; i++) {
        const oldest = iter.next();
        if (oldest.done) break;
        this.conversations.delete(oldest.value);
      }
    }
  }

  private touchConversation(threadId: string, conv: ConversationMemory): void {
    conv.lastSeenAt = Date.now();
    // Re-insert to update LRU order in Map insertion order semantics.
    this.conversations.delete(threadId);
    this.conversations.set(threadId, conv);
  }

  private getAgent(opts: ChatOptions): Promise<A2UIAgent> {
    const cacheKey = `${opts.baseURL ?? 'default'}:${opts.model ?? 'default'}:${
      hashApiKey(opts.apiKey)
    }:${opts.catalog?.id ?? 'basic'}`;
    let cached = this.agentCache.get(cacheKey);
    if (cached) return cached;

    cached = Promise.resolve(
      createA2UIAgent(pickDefined({
        apiKey: opts.apiKey,
        baseURL: opts.baseURL,
        model: opts.model,
        catalog: opts.catalog,
      })).agent,
    );
    this.agentCache.set(cacheKey, cached);
    return cached;
  }

  private toModelMessages(messages: ChatMessage[]) {
    return messages.map((m) => ({ role: m.role, content: m.content }));
  }

  public getConversation(threadId: string): ConversationMemory {
    this.sweepConversations(Date.now());
    const existing = this.conversations.get(threadId);
    if (existing) {
      this.touchConversation(threadId, existing);
      return existing;
    }
    const conv: ConversationMemory = {
      history: [],
      surfaceIds: new Set<string>(),
      dataModel: {},
      lastSeenAt: Date.now(),
    };
    this.conversations.set(threadId, conv);
    return conv;
  }

  public peekConversation(threadId: string): ConversationMemory | undefined {
    const conv = this.conversations.get(threadId);
    if (conv) this.touchConversation(threadId, conv);
    return conv;
  }

  public resetConversation(threadId: string): void {
    this.conversations.delete(threadId);
  }

  public async stream(
    messages: ChatMessage[],
    opts: ChatOptions = {},
  ): Promise<MastraStreamResult> {
    const agent = await this.getAgent(opts);
    return agent.stream(
      this.toModelMessages(messages),
      pickDefined({
        threadId: opts.threadId,
        resourceId: opts.resourceId,
      }),
    ) as MastraStreamResult;
  }

  public async streamAsAsyncIterable(
    messages: ChatMessage[],
    opts: ChatOptions = {},
  ): Promise<{
    textStream: AsyncIterable<string>;
    finalize: () => Promise<{
      text: string | undefined;
      usage: unknown;
      finishReason: unknown;
    }>;
  }> {
    const streamResult: MastraStreamResult = await this.stream(
      messages,
      opts,
    );
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

  public async generate(
    messages: ChatMessage[],
    opts: ChatOptions = {},
  ): Promise<unknown> {
    const agent = await this.getAgent(opts);
    return agent.generate(
      this.toModelMessages(messages),
      pickDefined({
        threadId: opts.threadId,
        resourceId: opts.resourceId,
      }),
    );
  }

  public async generateRaw(
    messages: ChatMessage[],
    opts: ChatOptions = {},
  ): Promise<{ text: string; usage: unknown; finishReason: unknown }> {
    const result = await this.generate(messages, opts) as MastraResult;
    const text = await extractText(result);
    const usage = (await Promise.resolve(result?.usage).catch(() => undefined))
      ?? result?.usage;
    const finishReason =
      (await Promise.resolve(result?.finishReason).catch(() => undefined))
        ?? result?.finishReason;
    return { text, usage, finishReason };
  }

  public async generateValidated(
    messages: ChatMessage[],
    opts: ChatOptions = {},
  ): Promise<A2UIResponse> {
    const catalog = opts.catalog ?? BASIC_CATALOG;
    const maxAttempts = Math.max(1, opts.maxRepairAttempts ?? 2) + 1;
    const agent = await this.getAgent({ ...opts, catalog });

    const threadId = opts.threadId;
    const conv = threadId ? this.getConversation(threadId) : null;

    const convo: ChatMessage[] = [
      ...(conv ? conv.history : []),
      ...(conv && Object.keys(conv.dataModel).length > 0
        ? [buildDataModelSystemMessage(conv.dataModel)]
        : []),
      ...messages,
    ];

    let lastText = '';
    let lastErrors: string[] = [];
    let lastUsage: unknown;
    let lastFinishReason: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await agent.generate(
        this.toModelMessages(convo),
        pickDefined({
          threadId,
          resourceId: opts.resourceId,
        }),
      ) as MastraResult;

      const text = await extractText(result);
      lastText = text;
      lastUsage = (await Promise.resolve(result?.usage).catch(() => undefined))
        ?? result?.usage;
      lastFinishReason =
        (await Promise.resolve(result?.finishReason).catch(() => undefined))
          ?? result?.finishReason;

      const validation = validateA2UIOutput(text, catalog);
      if (validation.ok) {
        if (conv) {
          mergeIntoConversation(conv, messages, text, validation.messages);
        }
        return {
          ok: true,
          text,
          messages: validation.messages,
          errors: [],
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
      attempts: maxAttempts,
      usage: lastUsage,
      finishReason: lastFinishReason,
    };
  }
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

function mergeIntoConversation(
  conv: ConversationMemory,
  incoming: ChatMessage[],
  assistantText: string,
  messages: A2UIMessage[],
): void {
  conv.history.push(...incoming);
  conv.history.push({ role: 'assistant', content: assistantText });
  for (const msg of messages) {
    if ('createSurface' in msg && msg.createSurface) {
      conv.surfaceIds.add(msg.createSurface.surfaceId);
    } else if ('deleteSurface' in msg && msg.deleteSurface) {
      conv.surfaceIds.delete(msg.deleteSurface.surfaceId);
    } else if ('updateDataModel' in msg && msg.updateDataModel) {
      const updateDataModel = msg.updateDataModel as
        & typeof msg.updateDataModel
        & { value?: unknown };
      applyDataModel(
        conv.dataModel,
        updateDataModel.path ?? '/',
        updateDataModel.value,
      );
    }
  }
  const MAX_HISTORY = 20;
  if (conv.history.length > MAX_HISTORY) {
    conv.history.splice(0, conv.history.length - MAX_HISTORY);
  }
}

function applyDataModel(
  model: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  if (!path || path === '/' || path === '') {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(model, value as Record<string, unknown>);
    }
    return;
  }
  const parts = path.replace(/^\//, '').split('/').filter(Boolean);
  let cursor = model;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!key) continue;
    if (typeof cursor[key] !== 'object' || cursor[key] === null) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1];
  if (!last) return;
  if (value === undefined) {
    delete cursor[last];
  } else {
    cursor[last] = value;
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
