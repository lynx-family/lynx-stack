// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

function decodePointerSegment(segment: string): string {
  return segment.replaceAll('~1', '/').replaceAll('~0', '~');
}

export interface JsonPointerParent {
  path: string;
  segment: string;
}

export interface JsonPointerValue {
  path: string;
  value: unknown;
}

export function getJsonPointerParent(path: string): JsonPointerParent | null {
  const normalizedPath = path === '' ? '/' : path;
  if (normalizedPath === '/') return null;

  const separator = normalizedPath.lastIndexOf('/');
  return {
    path: separator <= 0 ? '/' : normalizedPath.slice(0, separator),
    segment: normalizedPath.slice(separator + 1),
  };
}

export function flattenJsonPointerValue(
  value: unknown,
  basePath: string,
  updates: JsonPointerValue[],
): void {
  const normalizedBase = basePath === '' ? '/' : basePath;
  updates.push({ path: normalizedBase, value });

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const childPath = normalizedBase === '/'
        ? `/${index}`
        : `${normalizedBase}/${index}`;
      flattenJsonPointerValue(item, childPath, updates);
    });
    return;
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const childPath = normalizedBase === '/'
        ? `/${key}`
        : `${normalizedBase}/${key}`;
      flattenJsonPointerValue(item, childPath, updates);
    }
  }
}

export function removeNestedValue(
  value: unknown,
  segments: readonly string[],
): { changed: boolean; value: unknown } {
  if (segments.length === 0) return { changed: true, value: undefined };
  if (value === null || typeof value !== 'object') {
    return { changed: false, value };
  }

  const [head, ...tail] = segments;
  const key = decodePointerSegment(head!);
  if (Array.isArray(value)) {
    const array = value as unknown[];
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= array.length) {
      return { changed: false, value };
    }
    const next = [...array];
    if (tail.length === 0) {
      next.splice(index, 1);
      return { changed: true, value: next };
    }
    const nested = removeNestedValue(next[index], tail);
    if (!nested.changed) return { changed: false, value };
    next[index] = nested.value;
    return { changed: true, value: next };
  }

  const record = value as Record<string, unknown>;
  if (!(key in record)) return { changed: false, value };
  const next = { ...record };
  if (tail.length === 0) {
    delete next[key];
    return { changed: true, value: next };
  }
  const nested = removeNestedValue(next[key], tail);
  if (!nested.changed) return { changed: false, value };
  next[key] = nested.value;
  return { changed: true, value: next };
}

export function setNestedValue(
  value: unknown,
  segments: readonly string[],
  replacement: unknown,
): unknown {
  if (segments.length === 0) return replacement;

  const [head, ...tail] = segments;
  const key = decodePointerSegment(head!);
  if (Array.isArray(value)) {
    const array = value as unknown[];
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0) return value;
    const next = [...array];
    next[index] = tail.length === 0
      ? replacement
      : setNestedValue(next[index], tail, replacement);
    return next;
  }

  const record = value !== null && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
  return {
    ...record,
    [key]: tail.length === 0
      ? replacement
      : setNestedValue(record[key], tail, replacement),
  };
}
