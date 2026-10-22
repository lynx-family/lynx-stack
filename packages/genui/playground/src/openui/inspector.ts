// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createParser } from '@openuidev/lang-core';

import { getQueryDefaults } from '@lynx-js/genui/openui/data-tools';
import { createOpenUiPromptLibrary } from '@lynx-js/genui/openui/prompt';

import { OPENUI_QUERY_DEFAULTS } from '../../lynx-src/openui/dataTools.js';
import { splitOpenUiResponse } from '../../lynx-src/openui/inlineResponse.js';

// Inspector-only cache shared by the JSON and Query data tabs.
const cache = new Map<string, {
  defaults?: Record<string, unknown>;
  json?: string;
}>();
let parser: ReturnType<typeof createParser> | undefined;

function entry(source: string) {
  const value = cache.get(source) ?? {};
  cache.delete(source);
  cache.set(source, value);
  if (cache.size > 16) cache.delete(cache.keys().next().value!);
  return value;
}

/** Store renderer defaults separately from restored/prefetched Query results. */
export function cacheOpenUIQueryDefaults(
  source: string,
  defaults: Record<string, unknown>,
) {
  entry(source).defaults = defaults;
}

/** The caller validates the preview frame, origin and navigation token. */
export function receiveOpenUIQueryDefaults(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const message = value as {
    type?: unknown;
    rawText?: unknown;
    defaults?: unknown;
  };
  if (
    message.type !== OPENUI_QUERY_DEFAULTS
    || typeof message.rawText !== 'string'
    || !message.defaults || typeof message.defaults !== 'object'
    || Array.isArray(message.defaults)
  ) return false;
  cacheOpenUIQueryDefaults(
    message.rawText,
    message.defaults as Record<string, unknown>,
  );
  return true;
}

function parseForInspector(source: string) {
  const value = entry(source);
  if (value.json !== undefined) return value;
  if (!parser) {
    const library = createOpenUiPromptLibrary();
    parser = createParser(library.toJSONSchema(), library.root);
  }
  const parts = splitOpenUiResponse(source);
  let defaults: Record<string, unknown> = {};
  const read = (text: string) => {
    const result = parser!.parse(text);
    defaults = { ...defaults, ...getQueryDefaults(result, { source: text }) };
    return result;
  };
  const result = parts.some(part => part.kind === 'code')
    ? parts.map(part =>
      part.kind === 'code' ? { ...part, result: read(part.content) } : part
    )
    : read(source);
  value.defaults ??= defaults;
  value.json = JSON.stringify(result, null, 2);
  return value;
}

/** Only inspector access without renderer defaults needs a fallback parse. */
export function readOpenUIQueryDefaults(
  source: string,
): Record<string, unknown> {
  return entry(source).defaults ?? parseForInspector(source).defaults!;
}

/** Format the parsed program for the JSON inspector; never used as renderer input. */
export function readOpenUIParsedJSON(source: string): string {
  try {
    return parseForInspector(source).json!;
  } catch (error) {
    return `Unable to parse OpenUI DSL:\n${String(error)}`;
  }
}
