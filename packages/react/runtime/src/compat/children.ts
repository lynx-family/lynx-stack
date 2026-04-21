// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ComponentChild } from 'preact';
import { Children as PreactChildren } from 'preact/compat';

/**
 * Wrapped `Children` utilities.
 *
 * `toArray` and `map` `Object.freeze` their returned arrays in `__DEV__` to
 * surface accidental mutations (push / splice / sort) that break compile-time
 * snapshot optimizations.
 *
 * **Known difference from React:** `forEach` delegates to Preact's
 * implementation, which returns an array (same as `map`) instead of
 * `undefined`. This is a Preact quirk and will not be fixed upstream.
 * Callers should not rely on the return value.
 */
export const Children: {
  forEach: (children: ComponentChild | ComponentChild[], fn: (child: ComponentChild, index: number) => void, thisArg?: any) => void;
  map: typeof PreactChildren.map;
  count: typeof PreactChildren.count;
  only: typeof PreactChildren.only;
  toArray: (children: ComponentChild | ComponentChild[]) => readonly any[];
} = {
  count: PreactChildren.count,
  only: PreactChildren.only,

  forEach(children: any, fn: any, thisArg?: any): void {
    PreactChildren.forEach(children, thisArg ? fn.bind(thisArg) : fn);
  },

  map(children: any, fn: any, thisArg?: any): ReturnType<typeof PreactChildren.map> {
    const arr = PreactChildren.map(children, thisArg ? fn.bind(thisArg) : fn);
    if (__DEV__ && arr != null) {
      Object.freeze(arr);
    }
    return arr;
  },

  toArray(children: any): readonly any[] {
    const arr = PreactChildren.toArray(children);
    if (__DEV__) {
      Object.freeze(arr);
    }
    return arr;
  },
};
