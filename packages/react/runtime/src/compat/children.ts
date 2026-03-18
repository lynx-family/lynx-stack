// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ComponentChild } from 'preact';
import { Children as PreactChildren } from 'preact/compat';

/**
 * Wrapped `Children` utilities.
 *
 * All methods delegate to Preact's `Children` except `toArray`, which
 * `Object.freeze`s the result in `__DEV__` to surface accidental mutations
 * (push / splice / sort) that break compile-time snapshot optimizations.
 */
export const Children: {
  forEach: typeof PreactChildren.forEach;
  map: typeof PreactChildren.map;
  count: typeof PreactChildren.count;
  only: typeof PreactChildren.only;
  toArray: (children: ComponentChild | ComponentChild[]) => readonly any[];
} = {
  forEach: PreactChildren.forEach,
  map: PreactChildren.map,
  count: PreactChildren.count,
  only: PreactChildren.only,

  toArray(children: any): readonly any[] {
    const arr = PreactChildren.toArray(children);
    if (__DEV__) {
      Object.freeze(arr);
    }
    return arr;
  },
};
