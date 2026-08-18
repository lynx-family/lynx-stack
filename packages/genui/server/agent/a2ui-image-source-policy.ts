// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { isLoadableImageSource } from './a2ui-validator.js';

const EMBEDDED_HTTP_URL = /https?:\/\/[^\s<>"'`\\]+/giu;
const EMBEDDED_SOURCE_TOKEN = /[^\s<>"'`\\]+/gu;
const LEADING_PROSE_PUNCTUATION = /^[\u005b({（【]+/u;
const TRAILING_PROSE_PUNCTUATION = /[\]),.;!?}，。；！？：）】]+$/u;
const MAX_SOURCE_COLLECTION_DEPTH = 40;

function normalizeImageSource(source: string): string | undefined {
  const trimmed = source.trim();
  if (!isLoadableImageSource(trimmed)) return undefined;
  if (!/^https?:/iu.test(trimmed)) return trimmed;

  try {
    return new URL(trimmed).toString();
  } catch {
    return undefined;
  }
}

function collectStringSources(
  source: string,
  collected: Set<string>,
  seen: WeakSet<object>,
  depth: number,
): void {
  const normalized = normalizeImageSource(source);
  if (normalized) collected.add(normalized);

  for (const match of source.matchAll(EMBEDDED_HTTP_URL)) {
    const candidate = match[0].replace(TRAILING_PROSE_PUNCTUATION, '');
    const embedded = normalizeImageSource(candidate);
    if (embedded) collected.add(embedded);
  }
  for (const match of source.matchAll(EMBEDDED_SOURCE_TOKEN)) {
    const candidate = match[0]
      .replace(LEADING_PROSE_PUNCTUATION, '')
      .replace(TRAILING_PROSE_PUNCTUATION, '');
    const markdownTarget = candidate.slice(candidate.lastIndexOf('(') + 1);
    for (const value of new Set([candidate, markdownTarget])) {
      const embedded = normalizeImageSource(value);
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
    collectImageSources(
      JSON.parse(trimmed) as unknown,
      collected,
      seen,
      depth + 1,
    );
  } catch {
    // Natural-language messages are not expected to be JSON.
  }
}

function collectImageSources(
  value: unknown,
  collected: Set<string>,
  seen: WeakSet<object>,
  depth: number,
): void {
  if (depth > MAX_SOURCE_COLLECTION_DEPTH) return;
  if (typeof value === 'string') {
    collectStringSources(value, collected, seen, depth);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      collectImageSources(item, collected, seen, depth + 1);
    }
    return;
  }
  for (const item of Object.values(value as Record<string, unknown>)) {
    collectImageSources(item, collected, seen, depth + 1);
  }
}

export function createA2UIImageSourcePolicy(
  providedValues: readonly unknown[],
  dynamicSources: () => readonly string[] = () => [],
): (source: string) => boolean {
  const providedSources = new Set<string>();
  const seen = new WeakSet<object>();
  for (const value of providedValues) {
    collectImageSources(value, providedSources, seen, 0);
  }

  return (source) => {
    const normalized = normalizeImageSource(source);
    if (!normalized) return false;
    if (providedSources.has(normalized)) return true;
    return dynamicSources().some((candidate) =>
      normalizeImageSource(candidate) === normalized
    );
  };
}
