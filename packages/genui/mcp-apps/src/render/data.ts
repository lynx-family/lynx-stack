// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { AppRenderData } from '../contract.js';

interface McpAppsHostData {
  embedded: boolean;
  mcpAppData: unknown;
  theme: 'light' | 'dark';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readTheme(value: unknown): 'light' | 'dark' | undefined {
  return value === 'light' || value === 'dark' ? value : undefined;
}

/** Resolve frame init data first and retain global-props compatibility. */
export function readMcpAppsHostData(
  initData: unknown,
  globalProps: unknown,
): McpAppsHostData {
  const initRecord = isRecord(initData) ? initData : {};
  const globalRecord = isRecord(globalProps) ? globalProps : {};
  const hasInitAppData = Object.prototype.hasOwnProperty.call(
    initRecord,
    'mcpAppData',
  );
  const embedded = typeof initRecord['embedded'] === 'boolean'
    ? initRecord['embedded']
    : globalRecord['embedded'] === true;

  return {
    embedded,
    mcpAppData: hasInitAppData
      ? initRecord['mcpAppData']
      : globalRecord['mcpAppData'],
    theme: readTheme(initRecord['theme'])
      ?? readTheme(globalRecord['theme'])
      ?? 'light',
  };
}

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

/** Reads Markdown fallback content from MCP Apps host data. */
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
