// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ReactNode } from 'react';

import { loadLazyBundle } from './core/lynx/lazy-bundle.js';
import type { DataProcessorDefinition, Root } from './lynx-api.js';
import { root } from './lynx-api.js';
import { initBackgroundRuntimeForRoot, initBackgroundRuntimeGlobals } from './lynx.js';
import { createRootContext, getCurrentRootContext, switchRootContext } from './render-context.js';
import { setRoot } from './root.js';
import { installContextSwitchHook } from './snapshot/lifecycle/contextSwitchHook.js';
import { renderBackground } from './snapshot/lynx/appCallbacks.js';
import { BackgroundSnapshotInstance } from './snapshot/snapshot/backgroundSnapshot.js';

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
  if (typeof __BACKGROUND__ === 'undefined' || !__BACKGROUND__) {
    return root;
  }

  initBackgroundRuntimeGlobals();
  installContextSwitchHook();

  const ctx = createRootContext(pageLynx);
  const runInRoot = (fn: () => void): void => {
    const prev = getCurrentRootContext();
    switchRootContext(ctx);
    try {
      fn();
    } finally {
      switchRootContext(prev);
    }
  };

  runInRoot(() => {
    setRoot(new BackgroundSnapshotInstance('root'));
    initBackgroundRuntimeForRoot();
  });
  pageLynx.loadLazyBundle = loadLazyBundle;

  return {
    render: (jsx: ReactNode): void => {
      runInRoot(() => renderBackground(jsx));
    },
    registerDataProcessors: (dataProcessorDefinition: DataProcessorDefinition): void => {
      pageLynx.registerDataProcessors(dataProcessorDefinition);
    },
  };
}
