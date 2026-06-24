// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ComponentChild, ComponentChildren } from 'preact';
import { Children as PreactChildren } from 'preact/compat';

/**
 * Type of ReactLynx children utilities.
 *
 * @public
 */
export type ReactLynxChildren = Omit<typeof PreactChildren, 'map' | 'forEach' | 'toArray'> & {
  map<T extends ComponentChild, R>(
    children: T | T[],
    fn: (child: T, index: number) => R,
  ): readonly R[] | null;
  forEach<T extends ComponentChild, R>(
    children: T | T[],
    fn: (child: T, index: number) => R,
  ): readonly R[] | null;
  toArray(children: ComponentChildren): Readonly<ReturnType<(typeof PreactChildren)['toArray']>>;
};
type ReactLynxMap = ReactLynxChildren['map'];

const mapFn: ReactLynxMap = (children, fn) => {
  // eslint-disable-next-line unicorn/no-array-callback-reference
  const mapped = PreactChildren.map(children, fn) as ReturnType<typeof fn>[] | null;
  return mapped == null ? null : Object.freeze(mapped);
};

export const Children: ReactLynxChildren = {
  map: mapFn,
  forEach: mapFn,
  count: PreactChildren.count,
  only: PreactChildren.only,

  toArray(children: ComponentChildren) {
    return Object.freeze(PreactChildren.toArray(children));
  },
};
