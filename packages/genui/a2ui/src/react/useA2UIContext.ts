// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useContext } from '@lynx-js/react';

import { A2UIContext } from './A2UIProvider.jsx';
import type { A2UIInternalContext } from './A2UIProvider.jsx';

/**
 * Internal helper used by catalog-component hooks (`useAction`, the
 * renderer, …) to reach the `<A2UI>`-owned context. NOT exported from
 * the package.
 */
export function useA2UIContext(): A2UIInternalContext {
  const ctx = useContext(A2UIContext);
  if (!ctx) {
    throw new Error(
      '[a2ui] Catalog-component hooks must be used inside a tree rendered '
        + 'by `<A2UI>`.',
    );
  }
  return ctx;
}
