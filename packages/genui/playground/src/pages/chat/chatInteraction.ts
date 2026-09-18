// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ChatHttpRequest, ChatInteractionLog } from './type.js';

const MAX_ENTRIES = 80;
const MAX_DETAIL_LENGTH = 12_000;
const MAX_REASONING_LENGTH = 64_000;
const MAX_MESSAGE_SUMMARIES = 4;
const MAX_COMPONENT_NAMES = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function shortMetadata(value: string): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

function summarizeProtocolMessage(message: unknown): string {
  if (!isRecord(message)) return 'Unrecognized protocol message';
  const operation = [
    'createSurface',
    'updateComponents',
    'updateDataModel',
    'deleteSurface',
  ].find((name) => isRecord(message[name]));
  const payload = operation ? message[operation] : undefined;
  if (!operation || !isRecord(payload)) return 'Unrecognized protocol message';

  const parts = [operation];
  if (typeof payload.surfaceId === 'string' && payload.surfaceId) {
    parts.push(shortMetadata(payload.surfaceId));
  }
  if (operation === 'updateComponents' && Array.isArray(payload.components)) {
    const components: unknown[] = payload.components;
    const count = components.length;
    const names = new Set<string>();
    let loading = 0;
    for (const component of components) {
      if (!isRecord(component) || typeof component.component !== 'string') {
        continue;
      }
      const name = component.component.trim();
      if (!name) continue;
      names.add(name);
      if (name === 'Loading') loading++;
    }
    const displayedNames = [...names].slice(0, MAX_COMPONENT_NAMES).map(
      (name) => shortMetadata(name),
    );
    if (names.size > MAX_COMPONENT_NAMES) {
      displayedNames.push(`+${names.size - MAX_COMPONENT_NAMES} more`);
    }
    parts.push(
      `${count} ${count === 1 ? 'component' : 'components'}`
        + (loading > 0 ? ` (${loading} loading)` : '')
        + (displayedNames.length > 0 ? `: ${displayedNames.join(', ')}` : ''),
    );
  }
  if (operation === 'updateDataModel' && typeof payload.path === 'string') {
    parts.push(shortMetadata(payload.path) || '/');
  }
  return parts.join(' · ');
}

function summarizeProtocolMessages(data: unknown): string {
  let messages: unknown[];
  if (Array.isArray(data)) {
    messages = data;
  } else if (isRecord(data) && Array.isArray(data.messages)) {
    messages = data.messages;
  } else {
    messages = [data];
  }
  if (messages.length === 0) return '0 messages';
  const summaries = messages.slice(0, MAX_MESSAGE_SUMMARIES).map(
    (message) => summarizeProtocolMessage(message),
  );
  const remaining = messages.length - summaries.length;
  if (remaining > 0) {
    summaries.push(
      `+ ${remaining} more ${remaining === 1 ? 'message' : 'messages'}`,
    );
  }
  return summaries.join('\n');
}

function summarizeFinalResponse(data: unknown): unknown {
  if (!isRecord(data)) return undefined;
  const validation = isRecord(data.validation) ? data.validation : undefined;
  const summary = {
    ...(typeof data.ok === 'boolean' ? { ok: data.ok } : {}),
    ...(typeof data.finishReason === 'string'
      ? { finishReason: data.finishReason }
      : {}),
    ...(validation
      ? {
        validation: {
          ...(typeof validation.ok === 'boolean' ? { ok: validation.ok } : {}),
          ...(Array.isArray(validation.messages)
            ? { messageCount: validation.messages.length }
            : {}),
          ...(Array.isArray(validation.errors)
            ? { errors: validation.errors }
            : {}),
          ...(Array.isArray(validation.warnings)
            ? { warnings: validation.warnings }
            : {}),
        },
      }
      : {}),
  };
  return Object.keys(summary).length > 0 ? summary : undefined;
}

function interactionText(event: string, data: unknown): string {
  if (event === 'message') return summarizeProtocolMessages(data);
  if (event === 'done' || event === 'json') {
    return JSON.stringify(summarizeFinalResponse(data), null, 2) ?? '';
  }
  if (event === 'delta') {
    return isRecord(data) && typeof data.text === 'string'
      ? data.text
      : (typeof data === 'string' ? data : '');
  }
  if (typeof data === 'string') return data;
  return JSON.stringify(data, null, 2) ?? '';
}

export function appendChatInteraction(
  log: ChatInteractionLog,
  event: string,
  elapsedMs: number,
  data?: unknown,
): ChatInteractionLog {
  if (['error', 'done', 'json'].includes(event) && isRecord(data)) {
    const { reasoning, ...details } = data;
    if (
      isRecord(reasoning) && typeof reasoning.text === 'string'
      && reasoning.text.trim()
    ) {
      log = {
        ...log,
        reasoning: {
          text: reasoning.text.slice(0, MAX_REASONING_LENGTH),
          truncated: reasoning.truncated === true
            || reasoning.text.length > MAX_REASONING_LENGTH,
        },
      };
    }
    // Keep reasoning out of the compact event timeline and its copy payload.
    data = details;
  }
  if (event === 'done' || event === 'json') {
    const payload = isRecord(data) ? data : {};
    let messages: unknown[] | undefined;
    if (
      isRecord(payload.validation) && Array.isArray(payload.validation.messages)
    ) {
      messages = payload.validation.messages;
    } else if (Array.isArray(payload.messages)) {
      messages = payload.messages;
    } else if (Array.isArray(data)) {
      messages = data;
    }
    // A JSON response or buffered stream may provide its messages only at the end.
    if (messages && !log.entries.some((entry) => entry.event === 'message')) {
      log = appendChatInteraction(log, 'message', elapsedMs, { messages });
    }
    const text = typeof data === 'string' ? data : payload.text;
    if (!log.rawOutput && typeof text === 'string' && text) {
      log = appendChatInteraction(log, 'delta', elapsedMs, { text });
    }
  }

  const detail = interactionText(event, data);
  if (event === 'delta' && !detail) return log;
  const previous = event === 'delta' ? log.rawOutput : undefined;
  const text = previous ? previous.detail + detail : detail;
  const entry = {
    event,
    elapsedMs: previous?.elapsedMs ?? elapsedMs,
    detail: text.slice(0, MAX_DETAIL_LENGTH),
    count: previous ? previous.count + 1 : 1,
    truncated: (previous?.truncated ?? false)
      || text.length > MAX_DETAIL_LENGTH,
  };
  if (event === 'delta') return { ...log, rawOutput: entry };

  const entries = [...log.entries, entry];
  const overflow = Math.max(0, entries.length - MAX_ENTRIES);
  return {
    ...log,
    // Keep request preparation, request metadata, and the latest events.
    entries: overflow > 0
      ? [...entries.slice(0, 2), ...entries.slice(2 + overflow)]
      : entries,
    omittedEntries: log.omittedEntries + overflow,
  };
}

export function serializeChatInteraction(log: ChatInteractionLog): string {
  return JSON.stringify(
    {
      entries: log.entries,
      omittedEntries: log.omittedEntries,
      ...(log.rawOutput
        ? {
          rawOutput: {
            elapsedMs: log.rawOutput.elapsedMs,
            count: log.rawOutput.count,
            truncated: log.rawOutput.truncated,
          },
        }
        : {}),
    },
    null,
    2,
  );
}

/** Select display metadata without copying provider credentials or headers. */
export function describeChatRequest(request: ChatHttpRequest): unknown {
  const body = request.body !== null && typeof request.body === 'object'
    ? request.body as Record<string, unknown>
    : {};
  const conversation = body.conversation !== null
      && typeof body.conversation === 'object'
    ? body.conversation as Record<string, unknown>
    : {};
  return {
    method: request.method ?? 'POST',
    path: new URL(request.url).pathname,
    ...(typeof body.model === 'string' ? { model: body.model } : {}),
    messageCount: Array.isArray(body.messages) ? body.messages.length : 0,
    historyMessageCount: Array.isArray(conversation.history)
      ? conversation.history.length
      : 0,
    designGuidance: body.enableDesignGuidance !== false,
    ...(typeof body.enableHtmlFragment === 'boolean'
      ? { htmlFragment: body.enableHtmlFragment }
      : {}),
  };
}

export function chatInteractionLabel(event: string): string {
  switch (event) {
    case 'start':
      return 'Preparing request';
    case 'request':
      return 'Request sent';
    case 'response':
      return 'Server response';
    case 'message':
      return 'Protocol messages';
    case 'done':
    case 'json':
      return 'Final response';
    case 'usage':
      return 'Token usage';
    case 'complete':
      return 'Completed';
    case 'error':
      return 'Error';
    default:
      return event;
  }
}
