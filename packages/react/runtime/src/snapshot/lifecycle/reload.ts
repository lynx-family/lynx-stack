// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Implements the reload (thinking of "refresh" in browser) for both main thread
 * and background thread.
 */

import { render } from 'preact';

import { destroyBackground } from './destroy.js';
import { renderMainThread } from './render.js';
import { increaseReloadVersion } from '../../core/reload-version.js';
import { __root, setRoot } from '../../root.js';
import { profileEnd, profileStart } from '../../shared/profile.js';
import { isEmptyObject } from '../../utils.js';
import { LifecycleConstant } from '../lifecycle/constant.js';
import { __pendingListUpdates } from '../list/pendingListUpdates.js';
import { hydrate } from '../renderToOpcodes/hydrate.js';
import { __page, setupPage } from '../snapshot/definition.js';
import { SnapshotInstance, snapshotInstanceManager } from '../snapshot/snapshot.js';
import { applyRefQueue } from '../snapshot/workletRef.js';
import {
  clearFirstScreenEventIdSwap,
  getFirstScreenSyncState,
  restoreFirstScreenSyncState,
} from './event/firstScreenSync.js';
import type { FirstScreenSyncState } from './event/firstScreenSync.js';
import { deinitGlobalSnapshotPatch } from './patch/snapshotPatch.js';
import { shouldDelayUiOps } from './ref/delay.js';

interface MainThreadReloadHandoff {
  oldRoot: SnapshotInstance;
  page: FiberElement;
  options: UpdatePageOption;
  firstScreenSyncState: FirstScreenSyncState;
}

const mainThreadReloadCompleterKey = Symbol.for(
  '__LYNX_MAIN_THREAD_RELOAD_COMPLETER__',
);
const mainThreadEntryReloaderKey = Symbol.for(
  '__LYNX_MAIN_THREAD_ENTRY_RELOADER__',
);

const lynxSymbols = lynx as unknown as Record<symbol, unknown>;

function completeMainThreadReload(handoff: MainThreadReloadHandoff): void {
  setupPage(handoff.page);
  restoreFirstScreenSyncState(handoff.firstScreenSyncState);
  finishMainThreadReload(handoff);
}

function finishMainThreadReload(handoff: MainThreadReloadHandoff): void {
  const { oldRoot, options, firstScreenSyncState } = handoff;

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

  if (firstScreenSyncState.isFirstScreenSynced) {
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

if (typeof __MAIN_THREAD__ !== 'undefined' && __MAIN_THREAD__) {
  lynxSymbols[mainThreadReloadCompleterKey] = completeMainThreadReload;
}

function reloadMainThread(data: unknown, options: UpdatePageOption): void {
  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileStart('ReactLynx::reloadMainThread');
  }

  increaseReloadVersion();

  if (typeof data == 'object' && data !== null && !isEmptyObject(data)) {
    Object.assign(lynx.__initData, data);
  }

  snapshotInstanceManager.clear();
  __pendingListUpdates.clearAttachedLists();
  clearFirstScreenEventIdSwap();

  const oldRoot = __root;
  if (
    typeof __EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__ !== 'undefined'
    && __EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__
  ) {
    // Keep the old tree until the new runtime has rendered, then let that
    // runtime own renderMainThread/hydrate and the rest of the reload.
    const handoff = {
      oldRoot: oldRoot as SnapshotInstance,
      page: __page,
      options,
      firstScreenSyncState: getFirstScreenSyncState(),
    } satisfies MainThreadReloadHandoff;

    (lynxSymbols[mainThreadEntryReloaderKey] as () => void)();
    (lynxSymbols[mainThreadReloadCompleterKey] as (handoff: MainThreadReloadHandoff) => void)(
      handoff,
    );
    return;
  }

  setRoot(new SnapshotInstance('root'));
  __root.__jsx = oldRoot.__jsx;
  finishMainThreadReload({
    oldRoot: oldRoot as SnapshotInstance,
    page: __page,
    options,
    firstScreenSyncState: getFirstScreenSyncState(),
  });
  return;
}

function reloadBackground(updateData: Record<string, any>): void {
  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileStart('ReactLynx::reloadBackground');
  }

  deinitGlobalSnapshotPatch();

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

export { reloadBackground, reloadMainThread };
