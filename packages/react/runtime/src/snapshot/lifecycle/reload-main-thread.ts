// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Implements the reload (thinking of "refresh" in browser) for the main thread.
 */

import { renderMainThread } from './render.js';
import { increaseReloadVersion } from '../../core/reload-version.js';
import { __root, setRoot } from '../../root.js';
import { profileEnd, profileStart } from '../../shared/profile.js';
import { isEmptyObject } from '../../utils.js';
import { LifecycleConstant } from '../lifecycle/constant.js';
import { __pendingListUpdates } from '../list/pendingListUpdates.js';
import { hydrate } from '../renderToOpcodes/hydrate.js';
import { __page } from '../snapshot/definition.js';
import { SnapshotInstance, snapshotInstanceManager } from '../snapshot/snapshot.js';
import { applyRefQueue } from '../snapshot/workletRef.js';
import { clearFirstScreenEventIdSwap, isFirstScreenSynced } from './event/firstScreenSync.js';

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
  setRoot(new SnapshotInstance('root'));
  __root.__jsx = oldRoot.__jsx;
  renderMainThread();
  hydrate(oldRoot as SnapshotInstance, __root as SnapshotInstance, {
    skipUnRef: true,
  });

  // always call this before `__FlushElementTree`
  __pendingListUpdates.flush();
  applyRefQueue();

  if (isFirstScreenSynced) {
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
  return;
}

export { reloadMainThread };
