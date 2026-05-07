// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ServerResponse } from 'node:http';

import type { AgentSseEventName } from './types.js';

export function initSse(res: ServerResponse): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
}

export function writeSseEvent(
  res: ServerResponse,
  event: AgentSseEventName,
  data: unknown,
): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function writeSseError(
  res: ServerResponse,
  error: unknown,
): void {
  const message = error instanceof Error ? error.message : String(error);
  writeSseEvent(res, 'error', { message });
}

export function closeSse(res: ServerResponse): void {
  res.end();
}

