// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ElementRef } from './papi-types.ts';

/**
 * Element geometry. See Shim_Design.md §4.2.5 and OQ-S.4.
 *
 * **OQ-S.4 resolution.** Spec `getBoundingClientRect` is synchronous; Lynx
 * PAPI only exposes a callback-based `__InvokeUIMethod(el, 'boundingClientRect')`.
 * We resolve the conflict by returning a zero rect on the first call,
 * scheduling the async measurement, caching the result on the callback, and
 * returning the cached value on every subsequent call. A `console.warn` with
 * diagnostic code `shim:L1/geometry-cached-stale` fires once per element on
 * the first miss.
 *
 * Cache invalidation hook is `invalidateGeometry(papi)`. US-411 / US-421
 * wire it into the L2 write paths so any mutation on `papi` or its
 * ancestors drops the cached rect.
 */

export interface DOMRectReadOnly {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

function makeRect(
  x: number,
  y: number,
  width: number,
  height: number,
): DOMRectReadOnly {
  return Object.freeze({
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
  });
}

const ZERO_RECT: DOMRectReadOnly = makeRect(0, 0, 0, 0);

const rectCache = new WeakMap<ElementRef, DOMRectReadOnly>();
const warned = new WeakSet<ElementRef>();

/**
 * Diagnostic code emitted on the first cache miss for an element. Listed in
 * SPEC/DIAGNOSTICS.md (US-449).
 */
export const GEOMETRY_STALE_CODE = 'shim:L1/geometry-cached-stale';

function emitWarn(papi: ElementRef): void {
  if (warned.has(papi)) return;
  warned.add(papi);
  console.warn(
    JSON.stringify({
      code: GEOMETRY_STALE_CODE,
      tier: 1,
      surface: 'Element.getBoundingClientRect',
      message:
        'First call returns a zero rect; async __InvokeUIMethod(boundingClientRect) scheduled. Subsequent calls return the cached value until invalidated by a mutation.',
    }),
  );
}

function fillFromCallback(
  papi: ElementRef,
  res: { code: number; data: unknown },
): void {
  if (res.code !== 0) return;
  const data = res.data;
  if (typeof data !== 'object' || data === null) return;
  const d = data as Record<string, unknown>;
  const left = typeof d['left'] === 'number' ? d['left'] : 0;
  const top = typeof d['top'] === 'number' ? d['top'] : 0;
  const width = typeof d['width'] === 'number' ? d['width'] : 0;
  const height = typeof d['height'] === 'number' ? d['height'] : 0;
  rectCache.set(papi, makeRect(left, top, width, height));
}

export function getBoundingClientRect(papi: ElementRef): DOMRectReadOnly {
  const cached = rectCache.get(papi);
  if (cached !== undefined) return cached;

  // Schedule (or trigger, depending on engine semantics) the measurement.
  // Some engine mocks fire the callback synchronously; in that case the
  // cache is populated before this function returns.
  try {
    __InvokeUIMethod(
      papi,
      'boundingClientRect',
      {},
      (res) => fillFromCallback(papi, res),
    );
  } catch {
    // Engine missing __InvokeUIMethod — cache stays empty.
  }

  const post = rectCache.get(papi);
  if (post !== undefined) return post;

  emitWarn(papi);
  return ZERO_RECT;
}

/**
 * Drop the cached rect for an element. L2 mutation paths (US-411..US-421)
 * call this when they touch geometry-affecting state.
 */
export function invalidateGeometry(papi: ElementRef): void {
  rectCache.delete(papi);
}
