// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { FC } from 'react';

// for better reuse if runtime is changed
export function factory(
  { createElement, useMemo, Suspense, lazy }: typeof import('react'),
  loadLazyBundle: any,
): FC<{ is: string }> {
  /**
   * @internal a polyfill for <component is=? />
   */
  const __ComponentIsPolyfill: FC<{ is: string }> = ({ is, ...props }) => {
    if (typeof is !== 'string') {
      lynx.reportError(
        new Error(
          'You must provide a string to props `is` when using syntax `<component is=? />`.',
        ),
      );
      return null;
    }
    // @ts-ignore
    const D = useMemo(() => lazy(() => loadLazyBundle(is)), [is]);
    return createElement(Suspense, { key: is }, createElement(D, props));
  };

  return __ComponentIsPolyfill;
}
