// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface NormalizedA2UIResult {
  messages: unknown;
  actionMocks?: unknown;
}

function tryParseJson(text: string): unknown | null {
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
  if (Array.isArray(record['messages'])) {
    return {
      messages: record['messages'],
      actionMocks: record['actionMocks'],
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

  const fencedBlocks = text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
  for (const match of fencedBlocks) {
    const block = match[1]?.trim();
    if (block) {
      candidates.add(block);
    }
  }

  return [...candidates];
}

export function normalizeA2UIResult(value: unknown): NormalizedA2UIResult | null {
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

