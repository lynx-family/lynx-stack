// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { equalJsonValues, isObject } from './utils.js';

/**
 * Apply server changes while preserving locally edited, unchanged fields.
 * Arrays with unique primitive id or key fields are matched by identity.
 * Unkeyed arrays are matched by index while all three lengths remain equal;
 * otherwise the server array replaces the local array.
 *
 * @internal
 */
export function reconcileDataModel(
  previous: unknown,
  next: unknown,
  current: unknown,
): unknown {
  if (equalJsonValues(previous, next)) return current;
  if (
    Array.isArray(previous) && Array.isArray(next) && Array.isArray(current)
  ) {
    const identities = ['id', 'key'].find(key =>
      hasUniqueIdentities(previous, key) && hasUniqueIdentities(next, key)
      && hasUniqueIdentities(current, key)
    );
    if (identities) {
      const previousItems = indexByIdentity(previous, identities);
      const currentItems = indexByIdentity(current, identities);
      const result = (next as unknown[]).map(item => {
        const key = (item as Record<string, unknown>)[identities];
        return previousItems.has(key) && currentItems.has(key)
          ? reconcileDataModel(
            previousItems.get(key),
            item,
            currentItems.get(key),
          )
          : item;
      });
      return equalJsonValues(current, result) ? current : result;
    }
    if (previous.length === next.length && current.length === next.length) {
      const result = next.map((item, index) =>
        reconcileDataModel(previous[index], item, current[index])
      );
      return equalJsonValues(current, result) ? current : result;
    }
    return equalJsonValues(current, next) ? current : next;
  }
  if (
    !isObject(previous) || Array.isArray(previous)
    || !isObject(next) || Array.isArray(next)
  ) {
    return equalJsonValues(current, next) ? current : next;
  }

  const local = isObject(current) && !Array.isArray(current) ? current : {};
  const result = { ...local };
  for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    const had = Object.prototype.hasOwnProperty.call(previous, key);
    const has = Object.prototype.hasOwnProperty.call(next, key);
    if (!has) {
      delete result[key];
    } else if (!had || !equalJsonValues(previous[key], next[key])) {
      Object.defineProperty(result, key, {
        value: had
          ? reconcileDataModel(previous[key], next[key], local[key])
          : next[key],
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }
  return equalJsonValues(current, result) ? current : result;
}

function hasUniqueIdentities(items: unknown[], key: string): boolean {
  const identities = new Set<unknown>();
  for (const item of items) {
    if (!isObject(item) || Array.isArray(item)) return false;
    const identity = item[key];
    if (
      typeof identity !== 'string'
      && !(typeof identity === 'number' && Number.isFinite(identity))
    ) return false;
    if (identities.has(identity)) return false;
    identities.add(identity);
  }
  return true;
}

function indexByIdentity(
  items: unknown[],
  key: string,
): Map<unknown, unknown> {
  return new Map(items.map(item => [
    (item as Record<string, unknown>)[key],
    item,
  ]));
}
