// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Implements the reload (thinking of "refresh" in browser) for both main thread
 * and background thread.
 */

import { render } from 'preact';

import { clearDelayedRunOnBackgroundFunctions } from '@lynx-js/react/worklet-runtime/bindings';

import { destroyBackground } from './destroy.js';
import { renderMainThread } from './render.js';
import {
  canReEvalBackgroundEntry,
  canReEvalMainThreadEntry,
  installMainThreadReloadCompleter,
  reEvalBackgroundEntry,
  reEvalMainThreadEntry,
} from '../../core/entry-reload.js';
import { increaseReloadVersion } from '../../core/reload-version.js';
import { resetFunctionCallReturnListener } from '../../core/thread-function-call/return-value.js';
import { __root, setRoot } from '../../root.js';
import { profileEnd, profileStart } from '../../shared/profile.js';
import { isEmptyObject } from '../../utils.js';
import { LifecycleConstant } from '../lifecycle/constant.js';
import { __pendingListUpdates } from '../list/pendingListUpdates.js';
import { hydrate } from '../renderToOpcodes/hydrate.js';
import { __page, setupPage } from '../snapshot/definition.js';
import { SnapshotInstance, snapshotInstanceManager } from '../snapshot/snapshot.js';
import { applyRefQueue } from '../snapshot/workletRef.js';
import { clearFirstScreenEventIdSwap, firstScreenSync } from './event/firstScreenSync.js';
import { shouldDelayUiOps } from './ref/delay.js';

function reloadMainThread(data: unknown, options: UpdatePageOption): void {
  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileStart('ReactLynx::reloadMainThread');
  }

  clearDelayedRunOnBackgroundFunctions();
  resetFunctionCallReturnListener();
  increaseReloadVersion();

  if (typeof data == 'object' && data !== null && !isEmptyObject(data)) {
    Object.assign(lynx.__initData, data);
  }

  snapshotInstanceManager.clear();
  __pendingListUpdates.clearAttachedLists();
  clearFirstScreenEventIdSwap();

  const oldRoot = __root;
  if (canReEvalMainThreadEntry()) {
    reEvalMainThreadEntry<MainThreadReloadHandoff>({ oldRoot: oldRoot as SnapshotInstance, page: __page, options });
    return;
  }
  setRoot(new SnapshotInstance('root'));
  __root.__jsx = oldRoot.__jsx;
  finishMainThreadReload(oldRoot as SnapshotInstance, options);
}

interface MainThreadReloadHandoff {
  oldRoot: SnapshotInstance;
  page: FiberElement;
  options: UpdatePageOption;
}

function completeMainThreadReload({ oldRoot, page, options }: MainThreadReloadHandoff): void {
  setupPage(page);
  finishMainThreadReload(oldRoot, options);
}

installMainThreadReloadCompleter(completeMainThreadReload);

function finishMainThreadReload(oldRoot: SnapshotInstance, options: UpdatePageOption): void {
  renderMainThread();
  hydrate(oldRoot, __root as SnapshotInstance, {
    skipUnRef: true,
  });

  // always call this before `__FlushElementTree`
  __pendingListUpdates.flush();
  applyRefQueue();

  if (typeof lepusng_gc === 'function') {
    lepusng_gc();
  }

  if (firstScreenSync.isSynced) {
    __OnLifecycleEvent([
      LifecycleConstant.firstScreen, /* FIRST_SCREEN */
      {
        root: JSON.stringify(__root),
      },
    ]);
  }

  __FlushElementTree(__page, options);

  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileEnd();
  }
}

function reloadBackground(updateData: Record<string, any>, options?: Record<string, unknown>): void {
  if (canReEvalBackgroundEntry()) {
    reEvalBackgroundEntry(updateData, options, () => {
      // A queued `updateGlobalProps` callback must not render it again.
      __root.__jsx = undefined;
    });
    return;
  }

  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileStart('ReactLynx::reloadBackground');
  }

  destroyBackground();
  increaseReloadVersion();

  // COW when modify `lynx.__initData` to make sure Provider & Consumer works
  lynx.__initData = Object.assign({}, lynx.__initData, updateData);

  shouldDelayUiOps.value = true;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  render(__root.__jsx, __root as any);

  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileEnd();
  }
}

export { completeMainThreadReload, reloadBackground, reloadMainThread };
