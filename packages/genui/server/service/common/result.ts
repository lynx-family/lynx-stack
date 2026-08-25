// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { MastraResult, MastraStreamResult } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((part) => {
    if (!isRecord(part) || typeof part.text !== 'string') return '';
    return part.type === 'text' || part.type === 'output_text' ? part.text : '';
  }).join('');
}

export async function extractText(result: MastraResult): Promise<string> {
  const text = await Promise.resolve(result.text).catch(() => undefined);
  if (typeof text === 'string' && text.trim()) return text;

  const content = await Promise.resolve(result.content).catch(() => undefined);
  const contentText = textFromContent(content);
  if (contentText.trim()) return contentText;

  const response = await Promise.resolve(result.response).catch(
    () => undefined,
  );
  if (!isRecord(response) || !Array.isArray(response.messages)) return '';
  return response.messages.map((message) =>
    isRecord(message) ? textFromContent(message.content) : ''
  ).join('');
}

function isReadableStream(
  stream: ReadableStream<string> | AsyncIterable<string>,
): stream is ReadableStream<string> {
  return 'getReader' in stream && typeof stream.getReader === 'function';
}

export function toAsyncIterable(
  raw: MastraStreamResult['textStream'],
): AsyncIterable<string> {
  return {
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
}

export async function finalizeResult(result: MastraResult): Promise<{
  text: string | undefined;
  usage: unknown;
  finishReason: unknown;
}> {
  const [text, totalUsage, usage, finishReason] = await Promise.all([
    Promise.resolve(result.text).catch(() => undefined),
    Promise.resolve(result.totalUsage).catch(() => undefined),
    Promise.resolve(result.usage).catch(() => undefined),
    Promise.resolve(result.finishReason).catch(() => undefined),
  ]);
  return {
    text: typeof text === 'string' ? text : undefined,
    usage: totalUsage ?? usage,
    finishReason,
  };
}

export async function extractSuspension(result: MastraResult): Promise<{
  runId: string | undefined;
  toolCallId: string | undefined;
  suspendPayload: unknown;
}> {
  const runId = await Promise.resolve(result.runId).catch(() => undefined);
  const rawSuspendPayload = await Promise.resolve(result.suspendPayload).catch(
    () => undefined,
  );
  const toolCallEnvelope = isRecord(rawSuspendPayload)
      && 'suspendPayload' in rawSuspendPayload
      && (
        typeof rawSuspendPayload.toolCallId === 'string'
        || typeof rawSuspendPayload.toolName === 'string'
      )
    ? rawSuspendPayload
    : undefined;
  return {
    runId: typeof runId === 'string' ? runId : undefined,
    toolCallId: typeof toolCallEnvelope?.toolCallId === 'string'
      ? toolCallEnvelope.toolCallId
      : undefined,
    suspendPayload: toolCallEnvelope
      ? toolCallEnvelope.suspendPayload
      : rawSuspendPayload,
  };
}

export async function extractGenerationResult(result: MastraResult): Promise<{
  text: string;
  usage: unknown;
  finishReason: unknown;
}> {
  const [text, metadata] = await Promise.all([
    extractText(result),
    finalizeResult(result),
  ]);
  return {
    text,
    usage: metadata.usage,
    finishReason: metadata.finishReason,
  };
}
