// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const PROFILE_ARRAY_DETAIL_THRESHOLD = 128;
export const PROFILE_ARRAY_DETAIL_PREFIX_ITEMS = 32;

export function isLargeProfileArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
    && value.length > PROFILE_ARRAY_DETAIL_THRESHOLD;
}

function prefixKeys(
  value: unknown[],
  previous?: unknown,
): string[] {
  const keys: string[] = [];
  for (
    let index = 0;
    index < Math.min(value.length, PROFILE_ARRAY_DETAIL_PREFIX_ITEMS);
    index++
  ) {
    if (
      Object.prototype.propertyIsEnumerable.call(value, index)
      && (previous === undefined
        || (previous as Record<number, unknown> | null)?.[index]
          !== value[index])
    ) {
      keys.push(String(index));
    }
  }
  return keys;
}

export function summarizeLargeProfileArrayKeys(
  value: unknown[],
): string {
  return JSON.stringify({
    version: 1,
    type: 'array-prefix',
    length: value.length,
    keys: prefixKeys(value),
    omitted: Math.max(0, value.length - PROFILE_ARRAY_DETAIL_PREFIX_ITEMS),
    tail: 'not-inspected',
  });
}

export function summarizeLargeProfileArrayValue(
  value: unknown[],
): string {
  return JSON.stringify({
    version: 1,
    type: 'array',
    length: value.length,
    detail: 'omitted',
  });
}

export function summarizeLargeProfileArrayChangedKeys(
  currentState: unknown,
  nextState: unknown[],
): string {
  return JSON.stringify({
    version: 1,
    type: 'array-prefix-diff',
    currentLength: Array.isArray(currentState)
      ? currentState.length
      : undefined,
    nextLength: nextState.length,
    keys: prefixKeys(nextState, currentState),
    omitted: Math.max(0, nextState.length - PROFILE_ARRAY_DETAIL_PREFIX_ITEMS),
    tail: 'not-inspected',
  });
}
