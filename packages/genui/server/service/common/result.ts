// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { MastraResult, MastraStreamResult } from './types';

/** Stop protocol postprocessing while retaining the failed model's usage. */
export class GenerationUpstreamError extends Error {
  readonly statusCode?: number;
  readonly upstreamRequestId?: string;

  constructor(
    cause: unknown,
    public readonly result: {
      text: string;
      usage: unknown;
      finishReason: unknown;
    },
  ) {
    super(
      upstreamErrorMessage(cause),
      { cause },
    );
    this.name = 'GenerationUpstreamError';
    // Select only public diagnostics; never forward provider bodies or headers.
    let current = cause;
    for (let depth = 0; depth < 5 && isRecord(current); depth++) {
      if (
        this.statusCode === undefined
        && typeof current.statusCode === 'number'
        && Number.isInteger(current.statusCode)
        && current.statusCode >= 100 && current.statusCode <= 599
      ) this.statusCode = current.statusCode;
      const headers = current.responseHeaders;
      if (this.upstreamRequestId === undefined && isRecord(headers)) {
        const requestId = Object.entries(headers).find(([name, value]) =>
          name.toLowerCase() === 'x-request-id' && typeof value === 'string'
        )?.[1];
        if (typeof requestId === 'string') this.upstreamRequestId = requestId;
      }
      current = current.cause;
    }
  }
}

/** Preserve model evidence when deterministic postprocessing rejects its output. */
export class GenerationPostprocessError extends Error {
  constructor(
    cause: unknown,
    public readonly result: {
      text: string;
      usage: unknown;
      finishReason: unknown;
    },
  ) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(
      result.finishReason === 'length'
        ? `Model output reached its token limit before producing a valid final artifact: ${reason}`
        : reason,
      { cause },
    );
    this.name = 'GenerationPostprocessError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function upstreamErrorMessage(cause: unknown): string {
  if (
    isRecord(cause) && typeof cause.message === 'string' && cause.message.trim()
  ) {
    return cause.message;
  }
  if (typeof cause === 'string' && cause.trim()) return cause;
  return 'Upstream model generation failed without error details';
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
  let completionError: unknown;
  const onCompletionError = (error: unknown) => {
    completionError ??= error;
    return undefined;
  };
  const [text, totalUsage, usage, finishReason] = await Promise.all([
    Promise.resolve(result.text).catch(onCompletionError),
    Promise.resolve(result.totalUsage).catch(() => undefined),
    Promise.resolve(result.usage).catch(() => undefined),
    Promise.resolve(result.finishReason).catch(onCompletionError),
  ]);
  // Mastra populates its error getter while consuming the stream, so read it
  // after awaiting completion, not alongside the delayed result properties.
  const upstreamError =
    await Promise.resolve(result.error).catch((error: unknown) => error)
      ?? completionError;
  if (finishReason === 'error' || upstreamError != null) {
    throw new GenerationUpstreamError(upstreamError, {
      text: typeof text === 'string' ? text : '',
      usage: totalUsage ?? usage,
      finishReason: 'error',
    });
  }
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
