// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { bindPageLynx } from './core/page-lynx.js';
import { root } from './lynx-api.js';
import type { Root } from './lynx-api.js';
import { initBackgroundRuntime } from './lynx.js';

/**
 * Binds the runtime to one page's `lynx` and returns that page's root. Requires
 * `experimental_lynxGroupModuleSharing`; unstable and subject to change.
 *
 * @example
 *
 * ```ts
 * import { createRoot } from '@lynx-js/react/internal'
 *
 * createRoot(lynx).render(<App />)
 * ```
 *
 * @experimental
 * @alpha
 */
export function createRoot(pageLynx: typeof lynx): Root {
  if (
    typeof __LYNX_GROUP_MODULE_SHARING__ === 'undefined'
    || !__LYNX_GROUP_MODULE_SHARING__
  ) {
    throw new Error('createRoot(lynx) requires the experimental_lynxGroupModuleSharing option of pluginReactLynx.');
  }
  if (typeof __BACKGROUND__ !== 'undefined' && __BACKGROUND__) {
    bindPageLynx(pageLynx);
    initBackgroundRuntime();
  }
  return root;
}
