// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { render } from 'preact';
import type { ReactNode } from 'react';

import { setBoundRoot } from './bound-root.js';
import { root } from './lynx-api.js';
import { RootContext, getCurrentRootContext, switchRootContext } from './root-context.js';
import type { RootLynx } from './root-context.js';
import { __root, setRoot } from './root.js';
import { LifecycleConstant } from './snapshot/lifecycle/constant.js';
import { installContextSwitchHook } from './snapshot/lifecycle/contextSwitchHook.js';
import { flushDelayedLifecycleEvents, registerAppHandlers } from './snapshot/lynx/tt.js';
import { BackgroundSnapshotInstance } from './snapshot/snapshot/backgroundSnapshot.js';
import type { SnapshotInstance } from './snapshot/snapshot/snapshot.js';

type RootContainer = (SnapshotInstance | BackgroundSnapshotInstance) & {
  __jsx?: ReactNode;
};


/**
 * @internal
 */
export class ReactLynxRoot {
  _container: RootContainer;
  _ctx: RootContext;

  constructor(pageLynx?: RootLynx) {
    installContextSwitchHook();
    this._ctx = new RootContext();
    this._ctx.lynx = pageLynx;
    if (typeof __MAIN_THREAD__ !== 'undefined' && __MAIN_THREAD__) {
      this._container = __root as RootContainer;
    } else {
      const prev = getCurrentRootContext();
      switchRootContext(this._ctx);
      try {
        this._container = new BackgroundSnapshotInstance('root');
        setRoot(this._container);
      } finally {
        switchRootContext(prev);
      }
      registerAppHandlers(this._ctx);
    }
  }

  render(jsx: ReactNode): void {
    this._container.__jsx = jsx;
    if (typeof __BACKGROUND__ !== 'undefined' && __BACKGROUND__) {
      const prev = getCurrentRootContext();
      switchRootContext(this._ctx);
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        render(jsx, this._container as any);
        if (this._ctx.lynx) {
          if (__FIRST_SCREEN_SYNC_TIMING__ === 'jsReady') {
            this._ctx.lynx.getNativeApp().callLepusMethod(LifecycleConstant.firstScreenSyncReady, {});
          } else {
            flushDelayedLifecycleEvents();
          }
        }
      } finally {
        switchRootContext(prev);
      }
    }
  }

  unmount(): void {
    if (typeof __BACKGROUND__ !== 'undefined' && __BACKGROUND__) {
      const prev = getCurrentRootContext();
      switchRootContext(this._ctx);
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        render(null, this._container as any);
        this._ctx.commitTaskMap.forEach(task => {
          task();
        });
        this._ctx.commitTaskMap.clear();
      } finally {
        switchRootContext(prev);
      }
    }
    delete this._container.__jsx;
  }
}

/**
 * Create a root bound to one page's `lynx`.
 *
 * When the ReactLynx runtime lives in a chunk shared by several cards of a
 * shared-context LynxGroup, the module-level `lynx` is whichever card
 * evaluated the chunk first. Each page entry instead passes its own `lynx`
 * here, so lifecycle events, element commits, and `useLynx()` all resolve
 * to the page that rendered, not the first one:
 *
 * ```ts
 * import { createRoot } from '@lynx-js/react'
 *
 * const root = createRoot(lynx)
 * root.render(<App />)
 * ```
 *
 * On the main thread this is a no-op passthrough — main-thread code is
 * compiled per page and keeps using the default root.
 *
 * @public
 */
export function createRoot(pageLynx?: RootLynx): ReactLynxRoot | undefined {
  if (typeof __BACKGROUND__ !== 'undefined' && __BACKGROUND__) {
    const boundRoot = pageLynx ? new ReactLynxRoot(pageLynx) : undefined;
    setBoundRoot(boundRoot);
    return boundRoot;
  }
  return undefined;
}

/**
 * @internal
 */
export interface RootWithBindRenderContext {
  __experimentalBindRenderContext?: (pageLynx?: RootLynx) => ReactLynxRoot | undefined;
}

if (typeof __MULTI_ROOT_RENDER_CONTEXT__ !== 'undefined' && __MULTI_ROOT_RENDER_CONTEXT__) {
  (root as RootWithBindRenderContext).__experimentalBindRenderContext = createRoot;
}
