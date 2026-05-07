// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface NormalizedA2UIResult {
  messages: unknown;
  actionMocks?: unknown;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toNormalized(value: unknown): NormalizedA2UIResult | null {
  if (Array.isArray(value)) {
    return { messages: value };
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (Array.isArray(record.messages)) {
    return {
      messages: record.messages,
      actionMocks: record.actionMocks,
    };
  }

  return null;
}

function extractJsonCandidates(text: string): string[] {
  const candidates = new Set<string>();
  const trimmed = text.trim();
  if (trimmed) {
    candidates.add(trimmed);
  }

  let searchStart = 0;
  while (searchStart < text.length) {
    const fenceStart = text.indexOf('```', searchStart);
    if (fenceStart === -1) {
      break;
    }

    const contentStart = fenceStart + 3;
    const fenceEnd = text.indexOf('```', contentStart);
    if (fenceEnd === -1) {
      break;
    }

    let block = text.slice(contentStart, fenceEnd);
    if (block.slice(0, 4).toLowerCase() === 'json') {
      const nextChar = block[4];
      if (nextChar === undefined || /\s/.test(nextChar)) {
        let bodyStart = 4;
        while (bodyStart < block.length && /\s/.test(block[bodyStart])) {
          bodyStart += 1;
        }
        block = block.slice(bodyStart);
      }
    }

    const trimmedBlock = block.trim();
    if (trimmedBlock) {
      candidates.add(trimmedBlock);
    }

    searchStart = fenceEnd + 3;
  }

  return [...candidates];
}

export function normalizeA2UIResult(
  value: unknown,
): NormalizedA2UIResult | null {
  const normalized = toNormalized(value);
  if (normalized) {
    return normalized;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const candidates = extractJsonCandidates(value);
  for (const candidate of candidates) {
    const parsed = tryParseJson(candidate);
    const result = toNormalized(parsed);
    if (result) {
      return result;
    }
  }

  return null;
}
