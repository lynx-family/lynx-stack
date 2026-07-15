// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { corsHeaders } from './cors';

export interface SseEventOptions {
  id?: string | number;
}

export function encodeSSE(
  event: string,
  data: unknown,
  options: SseEventOptions = {},
): Uint8Array<ArrayBuffer> {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  const dataLines = String(payload)
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => `data: ${line}`)
    .join('\n');
  const id = options.id === undefined ? '' : `id: ${options.id}\n`;
  return new TextEncoder().encode(
    `${id}event: ${event}\n${dataLines}\n\n`,
  );
}

export function encodeSseComment(comment: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`: ${comment}\n\n`);
}

export function sseHeaders(
  req: Request,
  extra?: HeadersInit,
): Headers {
  const headers = corsHeaders(req, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  new Headers(extra).forEach((value, key) => headers.set(key, value));
  return headers;
}
