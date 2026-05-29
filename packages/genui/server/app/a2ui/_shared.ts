// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { A2UICatalog } from '../../agent/a2ui-catalog';
import type {
  ChatMessage,
  ChatOptions,
  ConversationContext,
} from '../../service/a2ui-agent';

export interface A2UIChatBody {
  messages?: unknown;
  conversation?: unknown;
  resourceId?: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
  catalog?: A2UICatalog;
  maxRepairAttempts?: number;
  validate?: boolean;
}

export type A2UIDispatchAction =
  | {
    event: {
      name: string;
      context?: Record<string, unknown>;
    };
  }
  | {
    functionCall: {
      call: string;
      args?: Record<string, unknown>;
      returnType?: string;
    };
  };

export interface ValidatedAction {
  ok: true;
  action: A2UIDispatchAction;
  kind: 'event' | 'functionCall';
  name: string;
}

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return fallback;
  return n;
}

function clientOverridesAllowed(): boolean {
  return process.env.A2UI_ALLOW_CLIENT_OVERRIDE === '1';
}

export const MAX_BODY_BYTES = parsePositiveInt(
  process.env.A2UI_MAX_BODY_BYTES,
  64 * 1024,
);

export const MAX_MESSAGE_CHARS = parsePositiveInt(
  process.env.A2UI_MAX_MESSAGE_CHARS,
  8_000,
);

export const MAX_MESSAGES = parsePositiveInt(
  process.env.A2UI_MAX_MESSAGES,
  40,
);

export const MAX_CONVERSATION_CHARS = parsePositiveInt(
  process.env.A2UI_MAX_CONVERSATION_CHARS,
  16_000,
);

export function pickChatOptions(body: {
  resourceId?: string;
  model?: string;
  apiKey?: string;
  baseURL?: string;
  catalog?: A2UICatalog;
  maxRepairAttempts?: number;
}): ChatOptions {
  const allowOverride = clientOverridesAllowed();
  return {
    resourceId: body.resourceId,
    model: allowOverride ? body.model : undefined,
    apiKey: allowOverride ? body.apiKey : undefined,
    baseURL: allowOverride ? body.baseURL : undefined,
    catalog: body.catalog,
    maxRepairAttempts: body.maxRepairAttempts,
  };
}

export function errorMessage(
  err: unknown,
): { message: string; name?: string } {
  if (err instanceof Error) return { message: err.message, name: err.name };
  return { message: String(err) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validateAction(value: unknown):
  | ValidatedAction
  | { ok: false; status: number; error: string }
{
  if (!isRecord(value)) {
    return {
      ok: false,
      status: 400,
      error: 'action.event.name or action.functionCall.call is required',
    };
  }

  const hasEvent = 'event' in value;
  const hasFunctionCall = 'functionCall' in value;

  if (hasEvent && hasFunctionCall) {
    return {
      ok: false,
      status: 400,
      error: 'exactly one of action.event or action.functionCall is required',
    };
  }

  if (hasEvent && isRecord(value.event)) {
    const name = value.event.name;
    if (typeof name === 'string' && name.length > 0) {
      return {
        ok: true,
        action: value as A2UIDispatchAction,
        kind: 'event',
        name,
      };
    }
  }

  if (hasFunctionCall && isRecord(value.functionCall)) {
    const call = value.functionCall.call;
    if (typeof call === 'string' && call.length > 0) {
      return {
        ok: true,
        action: value as A2UIDispatchAction,
        kind: 'functionCall',
        name: call,
      };
    }
  }

  return {
    ok: false,
    status: 400,
    error: 'action.event.name or action.functionCall.call is required',
  };
}

export interface ValidatedMessages {
  ok: true;
  messages: ChatMessage[];
}

export interface InvalidMessages {
  ok: false;
  status: number;
  error: string;
}

export interface JsonBodyMetrics {
  declaredByteLength?: number;
  rawByteLength?: number;
  readMs?: number;
  parseMs?: number;
  totalMs: number;
}

export function validateMessages(
  value: unknown,
): ValidatedMessages | InvalidMessages {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, status: 400, error: 'messages is required' };
  }
  if (value.length > MAX_MESSAGES) {
    return {
      ok: false,
      status: 400,
      error: `too many messages (max ${MAX_MESSAGES})`,
    };
  }
  const messages: ChatMessage[] = [];
  for (let i = 0; i < value.length; i++) {
    const item = value[i] as unknown;
    if (
      item === null
      || typeof item !== 'object'
      || typeof (item as ChatMessage).role !== 'string'
      || typeof (item as ChatMessage).content !== 'string'
    ) {
      return {
        ok: false,
        status: 400,
        error: `messages[${i}] must be {role: string, content: string}`,
      };
    }
    const message = item as ChatMessage;
    if (message.content.length > MAX_MESSAGE_CHARS) {
      return {
        ok: false,
        status: 413,
        error: `messages[${i}].content exceeds ${MAX_MESSAGE_CHARS} characters`,
      };
    }
    messages.push(message);
  }
  return { ok: true, messages };
}

export function validateConversation(
  value: unknown,
):
  | { ok: true; conversation: ConversationContext | undefined }
  | InvalidMessages
{
  if (value === undefined) {
    return { ok: true, conversation: undefined };
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      status: 400,
      error: 'conversation must be {history, dataModel}',
    };
  }

  const record = value as {
    history?: unknown;
    dataModel?: unknown;
  };
  const rawHistory = record.history ?? [];
  if (!Array.isArray(rawHistory)) {
    return {
      ok: false,
      status: 400,
      error: 'conversation.history must be an array',
    };
  }
  if (rawHistory.length > MAX_MESSAGES) {
    return {
      ok: false,
      status: 400,
      error: `too many conversation messages (max ${MAX_MESSAGES})`,
    };
  }

  const history: ChatMessage[] = [];
  let totalChars = 0;
  for (let i = 0; i < rawHistory.length; i++) {
    const item = rawHistory[i] as unknown;
    if (
      item === null
      || typeof item !== 'object'
      || typeof (item as ChatMessage).role !== 'string'
      || typeof (item as ChatMessage).content !== 'string'
    ) {
      return {
        ok: false,
        status: 400,
        error:
          `conversation.history[${i}] must be {role: string, content: string}`,
      };
    }
    const message = item as ChatMessage;
    if (
      message.role !== 'user'
      && message.role !== 'assistant'
      && message.role !== 'system'
    ) {
      return {
        ok: false,
        status: 400,
        error: `conversation.history[${i}].role is invalid`,
      };
    }
    totalChars += message.content.length;
    if (totalChars > MAX_CONVERSATION_CHARS) {
      return {
        ok: false,
        status: 413,
        error:
          `conversation.history exceeds ${MAX_CONVERSATION_CHARS} characters`,
      };
    }
    history.push(message);
  }

  const dataModel = record.dataModel ?? {};
  if (
    dataModel === null
    || typeof dataModel !== 'object'
    || Array.isArray(dataModel)
  ) {
    return {
      ok: false,
      status: 400,
      error: 'conversation.dataModel must be an object',
    };
  }

  return {
    ok: true,
    conversation: {
      history,
      dataModel: dataModel as Record<string, unknown>,
    },
  };
}

export async function readJsonBodyWithLimit<T>(
  req: Request,
): Promise<
  | { ok: true; body: T; metrics: JsonBodyMetrics }
  | { ok: false; status: number; error: string; metrics: JsonBodyMetrics }
> {
  const startedAt = performance.now();
  const declaredLength = req.headers.get('content-length');
  const declaredByteLength = declaredLength
    ? Number(declaredLength)
    : undefined;
  if (
    declaredLength
    && declaredByteLength !== undefined
    && Number.isFinite(declaredByteLength)
    && declaredByteLength > MAX_BODY_BYTES
  ) {
    return {
      ok: false,
      status: 413,
      error: `request body exceeds ${MAX_BODY_BYTES} bytes`,
      metrics: {
        declaredByteLength,
        totalMs: performance.now() - startedAt,
      },
    };
  }

  let raw: string;
  const readStartedAt = performance.now();
  try {
    raw = await req.text();
  } catch {
    const now = performance.now();
    return {
      ok: false,
      status: 400,
      error: 'failed to read request body',
      metrics: {
        declaredByteLength,
        readMs: now - readStartedAt,
        totalMs: now - startedAt,
      },
    };
  }
  const readEndedAt = performance.now();

  const rawByteLength = Buffer.byteLength(raw, 'utf8');
  if (rawByteLength > MAX_BODY_BYTES) {
    const now = performance.now();
    return {
      ok: false,
      status: 413,
      error: `request body exceeds ${MAX_BODY_BYTES} bytes`,
      metrics: {
        declaredByteLength,
        rawByteLength,
        readMs: readEndedAt - readStartedAt,
        totalMs: now - startedAt,
      },
    };
  }

  const parseStartedAt = performance.now();
  try {
    const body = JSON.parse(raw) as T;
    const now = performance.now();
    return {
      ok: true,
      body,
      metrics: {
        declaredByteLength,
        rawByteLength,
        readMs: readEndedAt - readStartedAt,
        parseMs: now - parseStartedAt,
        totalMs: now - startedAt,
      },
    };
  } catch {
    const now = performance.now();
    return {
      ok: false,
      status: 400,
      error: 'invalid JSON body',
      metrics: {
        declaredByteLength,
        rawByteLength,
        readMs: readEndedAt - readStartedAt,
        parseMs: now - parseStartedAt,
        totalMs: now - startedAt,
      },
    };
  }
}
