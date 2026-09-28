// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { render } from 'preact';
import type { ReactNode } from 'react';

import type { DataProcessorDefinition, Root } from './lynx-api.js';
import { root } from './lynx-api.js';
import { initBackgroundRuntimeForRoot, initBackgroundRuntimeGlobals } from './lynx.js';
import { RootContext, getCurrentRootContext, switchRootContext } from './render-context.js';
import { setRoot } from './root.js';
import { profileEnd, profileStart } from './shared/profile.js';
import { LifecycleConstant } from './snapshot/lifecycle/constant.js';
import { installContextSwitchHook } from './snapshot/lifecycle/contextSwitchHook.js';
import { flushDelayedLifecycleEvents } from './snapshot/lynx/appCallbacks.js';
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

  const ctx = new RootContext();
  ctx.lynx = pageLynx;

  const prev = getCurrentRootContext();
  switchRootContext(ctx);
  let container: BackgroundSnapshotInstance & { __jsx?: ReactNode };
  try {
    container = new BackgroundSnapshotInstance('root');
    setRoot(container);
    initBackgroundRuntimeForRoot();
  } finally {
    switchRootContext(prev);
  }

  return {
    render: (jsx: ReactNode): void => {
      container.__jsx = jsx;
      const prevCtx = getCurrentRootContext();
      switchRootContext(ctx);
      try {
        if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
          profileStart('ReactLynx::renderBackground');
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        render(jsx, container as any);
        if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
          profileEnd();
        }
        if (__FIRST_SCREEN_SYNC_TIMING__ === 'jsReady') {
          pageLynx.getNativeApp().callLepusMethod(LifecycleConstant.firstScreenSyncReady, {});
        } else {
          flushDelayedLifecycleEvents();
        }
      } finally {
        switchRootContext(prevCtx);
      }
    },
    registerDataProcessors: (dataProcessorDefinition: DataProcessorDefinition): void => {
      pageLynx.registerDataProcessors(dataProcessorDefinition);
    },
  };
}
