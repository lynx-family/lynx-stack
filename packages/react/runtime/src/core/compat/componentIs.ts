// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ComponentType } from 'preact';
import { Suspense, createElement, lazy } from 'preact/compat';

import { useMemo } from '../hooks/react.js';
import { loadLazyBundle } from '../lynx/lazy-bundle.js';

/**
 * @internal Compatibility for the compiler lowering of <component is=? />.
 */
export function __ComponentIsPolyfill({ is, ...props }: { is: string }) {
  const DynamicComponent = useMemo(
    // Lazy bundles expose React types but run on the host's Preact renderer.
    () =>
      lazy<ComponentType<Record<string, unknown>>>(() =>
        loadLazyBundle(is) as Promise<{ default: ComponentType<Record<string, unknown>> }>
      ),
    [is],
  );
  if (typeof is !== 'string') {
    lynx.reportError(
      new Error(
        'You must provide a string to props `is` when using syntax `<component is=? />`.',
      ),
    );
    return null;
  }
  return createElement(Suspense, { key: is, fallback: null }, createElement(DynamicComponent, props));
}
