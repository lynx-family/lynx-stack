// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  createResponsesReasoningStream,
  normalizeReasoningItem,
} from './openai-responses-reasoning.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeInputMessages(text: string): string {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return text;
  }
  if (!isRecord(value) || !Array.isArray(value.input)) return text;

  let changed = false;
  for (const item of value.input) {
    if (
      !isRecord(item) || item.role !== 'assistant'
      || (item.type !== undefined && item.type !== 'message')
      || !Array.isArray(item.content) || item.content.length === 0
      || !item.content.every(part =>
        isRecord(part)
        && (part.type === 'output_text' || part.type === 'refusal')
      )
    ) continue;

    // The SDK omits type and status when replaying assistant text. Some
    // compatible Responses endpoints require both on historical output messages.
    if (item.type === undefined) {
      item.type = 'message';
      changed = true;
    }
    if (item.status === undefined && item.partial !== true) {
      item.status = 'completed';
      changed = true;
    }
  }
  return changed ? JSON.stringify(value) : text;
}

function normalizeOutput(text: string): string {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    // Let the SDK report malformed JSON with its original response body.
    return text;
  }
  if (!isRecord(value) || !Array.isArray(value.output)) return text;

  let changed = false;
  for (const item of value.output) {
    if (isRecord(item)) changed = normalizeReasoningItem(item) || changed;
    if (
      !isRecord(item) || item.type !== 'message' || !Array.isArray(item.content)
    ) continue;
    for (const part of item.content) {
      if (
        isRecord(part) && part.type === 'output_text'
        && part.annotations === undefined
      ) {
        // Compatible Responses providers may omit the empty citation list.
        // Keep explicit values, including invalid ones, for SDK validation.
        part.annotations = [];
        changed = true;
      }
    }
  }
  return changed ? JSON.stringify(value) : text;
}

/** Normalize compatible Responses replies without buffering entire SSE streams. */
export function createResponsesCompatFetch(
  fetchImpl: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    if (typeof init?.body === 'string') {
      const body = normalizeInputMessages(init.body);
      if (body !== init.body) {
        const headers = new Headers(
          init.headers
            ?? (input instanceof Request ? input.headers : undefined),
        );
        headers.delete('content-length');
        init = { ...init, body, headers };
      }
    }
    const response = await fetchImpl(input, init);
    if (!response.ok || !response.body) return response;
    const contentType = response.headers.get('content-type')?.split(';')[0]
      ?.trim()
      .toLowerCase();
    if (contentType === 'text/event-stream') {
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      headers.delete('content-encoding');
      return new Response(
        response.body.pipeThrough(new TextDecoderStream())
          .pipeThrough(createResponsesReasoningStream())
          .pipeThrough(new TextEncoderStream()),
        { status: response.status, statusText: response.statusText, headers },
      );
    }
    if (contentType !== 'application/json') return response;

    const text = await response.text();
    const body = normalizeOutput(text);
    const headers = new Headers(response.headers);
    if (body !== text) {
      // fetch already decoded compressed bodies; the rewritten bytes have a
      // different length and must not retain the upstream encoding metadata.
      headers.delete('content-length');
      headers.delete('content-encoding');
    }
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
