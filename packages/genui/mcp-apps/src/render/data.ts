// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { AppRenderData } from '../contract.js';

function parseJsonLikeString(value: string): unknown {
  let current = value;
  for (let index = 0; index < 4; index++) {
    try {
      return JSON.parse(current) as unknown;
    } catch {
      // Native global props may contain URL-encoded JSON.
    }
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }
  return null;
}

function readAppDataCandidate(value: unknown): unknown {
  return typeof value === 'string' ? parseJsonLikeString(value) : value;
}

/** Reads Markdown fallback content from MCP Apps global data. */
export function readAppMarkdown(value: unknown): string {
  const candidate = readAppDataCandidate(value);
  if (
    candidate === null
    || typeof candidate !== 'object'
    || Array.isArray(candidate)
  ) {
    return '';
  }
  const markdown = (candidate as Record<string, unknown>)['markdown'];
  return typeof markdown === 'string' ? markdown : '';
}

/** Parses and validates the renderer-independent portion of MCP Apps data. */
export function readAppRenderData(value: unknown): AppRenderData | null {
  const candidate = readAppDataCandidate(value);
  if (
    candidate === null
    || typeof candidate !== 'object'
    || Array.isArray(candidate)
  ) {
    return null;
  }
  const record = candidate as Record<string, unknown>;
  const input = record['input'];
  if (
    typeof record['renderer'] !== 'string'
    || !record['renderer']
    || input === null
    || typeof input !== 'object'
    || Array.isArray(input)
  ) {
    return null;
  }
  return {
    renderer: record['renderer'],
    input: input as Record<string, unknown>,
    result: record['result'],
  };
}
