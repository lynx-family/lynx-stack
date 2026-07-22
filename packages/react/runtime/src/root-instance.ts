// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { render } from 'preact';
import type { ReactNode } from 'react';

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
 * @public
 */
export interface CreateRootOptions {
  lynx?: RootLynx;
  lynxCoreInject?: { tt: RootTT };
}

/**
 * @public
 */
export class ReactLynxRoot {
  /**
   * @internal
   */
  _container: RootContainer;

  /**
   * @internal
   */
  _ctx: RootContext;

  /** @internal */
  constructor(options?: CreateRootOptions) {
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

  /**
   * @public
   */
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

  /**
   * @public
   */
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
 * @public
 */
export function createRoot(options?: CreateRootOptions): ReactLynxRoot {
  return new ReactLynxRoot(options);
}

export type { RootLynx, RootNativeApp, RootTT } from './root-context.js';
