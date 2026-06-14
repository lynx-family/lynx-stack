// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ElementRef } from './papi-types.ts';

/**
 * Per-element write-through cache. See Shim_Design.md §3.2 + §5.2.5.
 *
 * The cache is the source of truth for property values whose PAPI read-back
 * is missing or unreliable:
 *
 * - `attrs` mirrors `setAttribute` / `removeAttribute` writes so subsequent
 *   `getAttribute` returns the just-written value even when the engine
 *   persists undefined as an empty slot (`shim:L2/attribute-removal-jsside-only`).
 * - `classes` mirrors classList mutations; lazy-initialized from `__GetClasses`
 *   on first read (`shim:L2/classlist-jsside-cache`).
 * - `styles` is authoritative for inline style read-back since Lynx PAPI's
 *   `__GetInlineStyle` requires a numeric propertyId and the string→propertyId
 *   table isn't accessible to JS (`shim:L2/style-jsside-cache-authoritative`).
 * - `dataset` mirrors `__AddDataset` writes for consistent read-back.
 * - `stylePriorities` records `!important` per OQ-S.3 — cache-only, NOT
 *   propagated to PAPI (`shim:L2/no-important-propagation`).
 */
export interface ElementCache {
  attrs: Map<string, string>;
  classes: string[] | null;
  styles: Map<string, string>;
  dataset: Map<string, string>;
  stylePriorities: Map<string, string>;
}

export type CacheKey = 'attrs' | 'classes' | 'styles' | 'dataset';

const cacheStore = new WeakMap<ElementRef, ElementCache>();

function createCache(): ElementCache {
  return {
    attrs: new Map<string, string>(),
    classes: null,
    styles: new Map<string, string>(),
    dataset: new Map<string, string>(),
    stylePriorities: new Map<string, string>(),
  };
}

/** Get or lazily allocate the cache for an element. */
export function getElementCache(ref: ElementRef): ElementCache {
  let c = cacheStore.get(ref);
  if (c === undefined) {
    c = createCache();
    cacheStore.set(ref, c);
  }
  return c;
}

/** Drop a single section of the cache for an element. */
export function invalidate(ref: ElementRef, key: CacheKey): void {
  const c = cacheStore.get(ref);
  if (c === undefined) return;
  switch (key) {
    case 'attrs':
      c.attrs.clear();
      break;
    case 'classes':
      c.classes = null;
      break;
    case 'styles':
      c.styles.clear();
      c.stylePriorities.clear();
      break;
    case 'dataset':
      c.dataset.clear();
      break;
    default:
      break;
  }
}

/** Drop the entire cache for an element (cloneNode, full refresh). */
export function invalidateAll(ref: ElementRef): void {
  cacheStore.delete(ref);
}

/**
 * Lazy-initialize classes from `__GetClasses`. Subsequent classList writes
 * mutate this array in lockstep. See `shim:L2/classlist-jsside-cache`.
 */
export function ensureClasses(ref: ElementRef): string[] {
  const c = getElementCache(ref);
  c.classes ??= [...__GetClasses(ref)];
  return c.classes;
}
