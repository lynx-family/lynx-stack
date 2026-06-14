// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { coerceAttributeValue } from './attributes.ts';
import { getElementCache } from './cache.ts';
import type { ElementRef } from './papi-types.ts';
import { scheduleFlush } from './scheduler.ts';

/**
 * Build a readonly proxy over the PAPI dataset. See Shim_Design.md §4.2.3.
 *
 * Spec DOMStringMap is "live" — accessing `el.dataset.foo` reflects current
 * `data-foo` regardless of intervening mutations. We use a Proxy so reads
 * hit `__GetDataByKey` on every access; iteration uses `__GetDataset` for
 * the full key list.
 *
 * Writes throw plain Error for now; US-474 will refine to
 * DOMShimInvariantError carrying `code: 'L1/dataset-readonly'`.
 * L2 writable variant lands in US-416.
 */
export function makeReadOnlyDataset(
  papi: ElementRef,
): Readonly<Record<string, string>> {
  const handler: ProxyHandler<Record<string, string>> = {
    get(_target, key): string | undefined {
      if (typeof key !== 'string') return undefined;
      // US-419: consult cache so L1 narrowed views observe L2 mutations.
      const cached = getElementCache(papi).dataset.get(key);
      if (cached !== undefined) return cached;
      const v = __GetDataByKey(papi, key);
      if (v === undefined || v === null) return undefined;
      return coerceAttributeValue(v);
    },
    has(_target, key): boolean {
      if (typeof key !== 'string') return false;
      if (getElementCache(papi).dataset.has(key)) return true;
      const v = __GetDataByKey(papi, key);
      return v !== undefined && v !== null;
    },
    ownKeys(_target): string[] {
      const cache = getElementCache(papi);
      const all = new Set<string>([
        ...Object.keys(__GetDataset(papi)),
        ...cache.dataset.keys(),
      ]);
      return [...all];
    },
    getOwnPropertyDescriptor(_target, key): PropertyDescriptor | undefined {
      if (typeof key !== 'string') return undefined;
      const cached = getElementCache(papi).dataset.get(key);
      if (cached !== undefined) {
        return {
          configurable: true,
          enumerable: true,
          writable: false,
          value: cached,
        };
      }
      const v = __GetDataByKey(papi, key);
      if (v === undefined || v === null) return undefined;
      return {
        configurable: true,
        enumerable: true,
        writable: false,
        value: coerceAttributeValue(v),
      };
    },
    set(): boolean {
      throw new Error(
        'dataset is readonly on L1 view; use the L2 writable dataset from US-416. US-474 will refine this to DOMShimInvariantError({ code: "L1/dataset-readonly" }).',
      );
    },
    deleteProperty(): boolean {
      throw new Error(
        'dataset is readonly on L1 view; same as set. US-474 refinement pending.',
      );
    },
  };
  return new Proxy({} as Record<string, string>, handler);
}

/**
 * L2 writable dataset proxy. See Shim_Design.md §5.2.4.
 *
 * Assignment routes through `__AddDataset(papi, key, value)` (PAPI accepts
 * a single key-value). Deletion clears the cache entry and re-pushes the
 * whole dataset via `__SetDataset` since there is no per-key remove
 * primitive — O(n) on delete.
 *
 * The cache mirrors writes so subsequent reads return the just-written
 * value within the same JS frame.
 */
export function makeWritableDataset(
  papi: ElementRef,
): Record<string, string> {
  const handler: ProxyHandler<Record<string, string>> = {
    get(_target, key): string | undefined {
      if (typeof key !== 'string') return undefined;
      const cache = getElementCache(papi);
      const cached = cache.dataset.get(key);
      if (cached !== undefined) return cached;
      const v = __GetDataByKey(papi, key);
      if (v === undefined || v === null) return undefined;
      return coerceAttributeValue(v);
    },
    set(_target, key, value): boolean {
      if (typeof key !== 'string') return false;
      const coerced = coerceAttributeValue(value);
      __AddDataset(papi, key, coerced);
      getElementCache(papi).dataset.set(key, coerced);
      scheduleFlush();
      return true;
    },
    deleteProperty(_target, key): boolean {
      if (typeof key !== 'string') return false;
      const cache = getElementCache(papi);
      cache.dataset.delete(key);
      // Rebuild dataset from cache + non-cached PAPI keys.
      const full: Record<string, unknown> = {};
      const merged: Record<string, unknown> = __GetDataset(papi);
      for (const [k, v] of Object.entries(merged)) {
        if (k !== key) full[k] = v;
      }
      // Layer cached writes back on top of the rebuilt PAPI snapshot.
      for (const [k, v] of cache.dataset.entries()) full[k] = v;
      __SetDataset(papi, full);
      scheduleFlush();
      return true;
    },
    has(_target, key): boolean {
      if (typeof key !== 'string') return false;
      const cache = getElementCache(papi);
      if (cache.dataset.has(key)) return true;
      const v = __GetDataByKey(papi, key);
      return v !== undefined && v !== null;
    },
    ownKeys(_target): string[] {
      const cache = getElementCache(papi);
      const papiKeys = Object.keys(__GetDataset(papi));
      const all = new Set<string>([...papiKeys, ...cache.dataset.keys()]);
      return [...all];
    },
    getOwnPropertyDescriptor(_target, key): PropertyDescriptor | undefined {
      if (typeof key !== 'string') return undefined;
      const cache = getElementCache(papi);
      let value: string | undefined = cache.dataset.get(key);
      if (value === undefined) {
        const v = __GetDataByKey(papi, key);
        if (v === undefined || v === null) return undefined;
        value = coerceAttributeValue(v);
      }
      return {
        configurable: true,
        enumerable: true,
        writable: true,
        value,
      };
    },
  };
  return new Proxy({} as Record<string, string>, handler);
}
