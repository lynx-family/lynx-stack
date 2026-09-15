// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const EMBEDDED_HTTP_URL = /https?:\/\/[^\s<>"'`\\]+/giu;
const EMBEDDED_SOURCE_TOKEN = /[^\s<>"'`\\]+/gu;
const LEADING_PROSE_PUNCTUATION = /^[\u005b({（【]+/u;
const TRAILING_PROSE_PUNCTUATION = /[\]),.;!?}，。；！？：）】]+$/u;
const MAX_SOURCE_COLLECTION_DEPTH = 40;

export type A2UISourceNormalizer = (
  source: string,
) => string | undefined;

function collectStringSources(
  source: string,
  normalizeSource: A2UISourceNormalizer,
  collected: Set<string>,
  seen: WeakSet<object>,
  depth: number,
): void {
  const normalized = normalizeSource(source);
  if (normalized) collected.add(normalized);

  for (const match of source.matchAll(EMBEDDED_HTTP_URL)) {
    const candidate = match[0].replace(TRAILING_PROSE_PUNCTUATION, '');
    const embedded = normalizeSource(candidate);
    if (embedded) collected.add(embedded);
  }
  for (const match of source.matchAll(EMBEDDED_SOURCE_TOKEN)) {
    const candidate = match[0]
      .replace(LEADING_PROSE_PUNCTUATION, '')
      .replace(TRAILING_PROSE_PUNCTUATION, '');
    const markdownTarget = candidate.slice(candidate.lastIndexOf('(') + 1);
    for (const value of new Set([candidate, markdownTarget])) {
      const embedded = normalizeSource(value);
      if (embedded) collected.add(embedded);
    }
  }

  const trimmed = source.trim();
  if (
    depth >= MAX_SOURCE_COLLECTION_DEPTH
    || (!trimmed.startsWith('{') && !trimmed.startsWith('['))
  ) {
    return;
  }
  try {
    collectSources(
      JSON.parse(trimmed) as unknown,
      normalizeSource,
      collected,
      seen,
      depth + 1,
    );
  } catch {
    // Natural-language messages are not expected to be JSON.
  }
}

function collectSources(
  value: unknown,
  normalizeSource: A2UISourceNormalizer,
  collected: Set<string>,
  seen: WeakSet<object>,
  depth: number,
): void {
  if (depth > MAX_SOURCE_COLLECTION_DEPTH) return;
  if (typeof value === 'string') {
    collectStringSources(value, normalizeSource, collected, seen, depth);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      collectSources(
        item,
        normalizeSource,
        collected,
        seen,
        depth + 1,
      );
    }
    return;
  }
  for (const item of Object.values(value as Record<string, unknown>)) {
    collectSources(item, normalizeSource, collected, seen, depth + 1);
  }
}

export function createA2UISourcePolicy(
  providedValues: readonly unknown[],
  normalizeSource: A2UISourceNormalizer,
  dynamicSources: () => readonly string[] = () => [],
): (source: string) => boolean {
  const providedSources = new Set<string>();
  const seen = new WeakSet<object>();
  for (const value of providedValues) {
    collectSources(value, normalizeSource, providedSources, seen, 0);
  }

  return (source) => {
    const normalized = normalizeSource(source);
    if (!normalized) return false;
    if (providedSources.has(normalized)) return true;
    return dynamicSources().some((candidate) =>
      normalizeSource(candidate) === normalized
    );
  };
}
