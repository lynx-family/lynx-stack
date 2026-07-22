// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { render } from 'preact';
import type { ReactNode } from 'react';

import { setBoundRoot } from './bound-root.js';
import { root } from './lynx-api.js';
import { RootContext, getCurrentRootContext, switchRootContext } from './root-context.js';
import type { RootLynx, RootTT } from './root-context.js';
import { __root, setRoot } from './root.js';
import { LifecycleConstant } from './snapshot/lifecycle/constant.js';
import './root-context-slots.js';
import './snapshot/lifecycle/contextSwitchHook.js';
import { globalCommitTaskMap } from './snapshot/lifecycle/patch/commit.js';
import { flushDelayedLifecycleEvents, injectTtInto } from './snapshot/lynx/tt.js';
import { BackgroundSnapshotInstance } from './snapshot/snapshot/backgroundSnapshot.js';
import type { SnapshotInstance } from './snapshot/snapshot/snapshot.js';

type RootContainer = (SnapshotInstance | BackgroundSnapshotInstance) & {
  __jsx?: ReactNode;
};

/**
 * @internal
 */
export interface BindRenderContextOptions {
  lynx?: RootLynx;
  lynxCoreInject?: { tt: RootTT };
}

/**
 * @internal
 */
export class ReactLynxRoot {
  _container: RootContainer;
  _ctx: RootContext;

  constructor(options?: BindRenderContextOptions) {
    this._ctx = new RootContext();
    this._ctx.lynx = options?.lynx;
    this._ctx.tt = options?.lynxCoreInject?.tt;
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
      if (this._ctx.tt) {
        injectTtInto(this._ctx.tt, this._ctx);
      }
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
        globalCommitTaskMap.forEach(task => {
          task();
        });
        globalCommitTaskMap.clear();
      } finally {
        switchRootContext(prev);
      }
    }
    delete this._container.__jsx;
  }
}

/**
 * @internal
 */
export interface RootWithBindRenderContext {
  __experimentalBindRenderContext?: (options?: BindRenderContextOptions) => ReactLynxRoot | undefined;
}

if (typeof __MULTI_ROOT_RENDER_CONTEXT__ !== 'undefined' && __MULTI_ROOT_RENDER_CONTEXT__) {
  (root as RootWithBindRenderContext).__experimentalBindRenderContext = (
    options?: BindRenderContextOptions,
  ): ReactLynxRoot | undefined => {
    /* v8 ignore next */
    if (typeof __BACKGROUND__ !== 'undefined' && __BACKGROUND__) {
      const boundRoot = options ? new ReactLynxRoot(options) : undefined;
      setBoundRoot(boundRoot);
      return boundRoot;
      /* v8 ignore start */
    } else {
      return undefined;
    }
    /* v8 ignore stop */
  };
}
