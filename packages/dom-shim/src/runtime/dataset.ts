// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { coerceAttributeValue } from './attributes.ts';
import type { ElementRef } from './papi-types.ts';

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
      const v = __GetDataByKey(papi, key);
      if (v === undefined || v === null) return undefined;
      return coerceAttributeValue(v);
    },
    has(_target, key): boolean {
      if (typeof key !== 'string') return false;
      const v = __GetDataByKey(papi, key);
      return v !== undefined && v !== null;
    },
    ownKeys(_target): string[] {
      return Object.keys(__GetDataset(papi));
    },
    getOwnPropertyDescriptor(_target, key): PropertyDescriptor | undefined {
      if (typeof key !== 'string') return undefined;
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
