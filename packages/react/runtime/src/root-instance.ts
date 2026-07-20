// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { render } from 'preact';
import type { ReactNode } from 'react';

import { RootContext, getCurrentRootContext, switchRootContext } from './root-context.js';
import type { RootLynx, RootTT } from './root-context.js';
import { __root, setRoot } from './root.js';
import { LifecycleConstant } from './snapshot/lifecycle/constant.js';
// Side effect: registers the Preact `renderComponent` hook that re-establishes
// the owner context before each component re-render.
import './snapshot/lifecycle/contextSwitchHook.js';
import { globalCommitTaskMap } from './snapshot/lifecycle/patch/commit.js';
import { flushDelayedLifecycleEvents, injectTtInto } from './snapshot/lynx/tt.js';
import { BackgroundSnapshotInstance } from './snapshot/snapshot/backgroundSnapshot.js';
import type { SnapshotInstance } from './snapshot/snapshot/snapshot.js';

type RootContainer = (SnapshotInstance | BackgroundSnapshotInstance) & {
  __jsx?: ReactNode;
};

/**
 * Options for {@link createRoot}, binding the root to one card's native
 * channels.
 *
 * When several pages share one background JS context, native still talks to
 * each card through that card's own bridge objects (its `lynx` and its
 * `lynxCoreInject.tt`). Passing them here wires this root to that card:
 * incoming native calls on the card's `tt` operate on this root only, and
 * this root's outgoing patches go to this card's native view only.
 *
 * @public
 */
export interface CreateRootOptions {
  /**
   * The card's own `lynx` object. Outgoing messages of this root
   * (e.g. patch updates) are sent through it.
   */
  lynx?: RootLynx;
  /**
   * The card's own `lynxCoreInject` object. The ReactLynx native-facing
   * handlers are injected onto its `tt`, bound to this root.
   */
  lynxCoreInject?: { tt: RootTT };
}

/**
 * An independent ReactLynx root, backed by its own private runtime context.
 *
 * Unlike the default `root` singleton (which is bound to the module-level
 * `__root`), each `ReactLynxRoot` owns a private container and a private set
 * of per-root runtime state (snapshot patch buffer, commit task map, delayed
 * event buffers, ...), so multiple roots can coexist in a single JS context
 * without their component trees, state, or patch streams clobbering each
 * other.
 *
 * @public
 */
export class ReactLynxRoot {
  /**
   * The private render container owned by this root.
   * @internal
   */
  _container: RootContainer;

  /**
   * The per-root runtime state.
   * @internal
   */
  _ctx: RootContext;

  /** @internal */
  constructor(options?: CreateRootOptions) {
    this._ctx = new RootContext();
    this._ctx.lynx = options?.lynx;
    this._ctx.tt = options?.lynxCoreInject?.tt;
    if (typeof __MAIN_THREAD__ !== 'undefined' && __MAIN_THREAD__) {
      // The main thread runs one card per VM, so there is nothing to
      // isolate: delegate to the default root, which is what `renderPage`
      // renders on first screen. This lets a card's entry use `createRoot`
      // unconditionally on both threads.
      this._container = __root as RootContainer;
    } else {
      const prev = getCurrentRootContext();
      switchRootContext(this._ctx);
      try {
        // Created while this context is current, so the container (and its
        // descendants, later) are stamped with this root.
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
   * Render `jsx` into this root's own container.
   *
   * On the main thread the JSX is only stashed on the default root (each
   * card's main-thread VM renders it during `renderPage`); on the background
   * thread it is rendered into this root's container immediately.
   *
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
          // This root has its own native channel: do the first-screen
          // handshake with its card, mirroring the default `root.render`.
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
   * Unmount this root, tearing down its container tree.
   *
   * @public
   */
  unmount(): void {
    if (typeof __BACKGROUND__ !== 'undefined' && __BACKGROUND__) {
      const prev = getCurrentRootContext();
      switchRootContext(this._ctx);
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        render(null, this._container as any);
        // Run this root's pending commit tasks (e.g. delayed instance
        // teardown), mirroring `destroyBackground`.
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
 * Create an independent {@link ReactLynxRoot}.
 *
 * @example
 *
 * ```ts
 * import { createRoot } from '@lynx-js/react'
 *
 * const rootA = createRoot();
 * rootA.render(<PageA />);
 *
 * const rootB = createRoot();
 * rootB.render(<PageB />); // independent from rootA
 * ```
 *
 * @public
 */
export function createRoot(options?: CreateRootOptions): ReactLynxRoot {
  return new ReactLynxRoot(options);
}

export type { RootLynx, RootNativeApp, RootTT } from './root-context.js';
