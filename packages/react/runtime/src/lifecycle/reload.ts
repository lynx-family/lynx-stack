// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { hydrate } from '../hydrate.js';
import { LifecycleConstant } from '../lifecycleConstant.js';
import { __pendingListUpdates } from '../list.js';
import { __root, setRoot } from '../root.js';
import { takeGlobalRefPatchMap } from '../snapshot/ref.js';
import { SnapshotInstance, __page, snapshotInstanceManager } from '../snapshot.js';
import { isEmptyObject } from '../utils.js';
import { destroyBackground } from './destroy.js';
import { destroyWorklet } from '../worklet/destroy.js';
import { clearJSReadyEventIdSwap, isJSReady } from './event/jsReady.js';
import { increaseReloadVersion } from './pass.js';
import { deinitGlobalSnapshotPatch } from './patch/snapshotPatch.js';
import { renderBackground, renderMainThread } from './render.js';

function reloadMainThread(data: any, options: UpdatePageOption): void {
  if (__PROFILE__) {
    console.profile('reloadTemplate');
  }

  increaseReloadVersion();

  if (typeof data == 'object' && !isEmptyObject(data)) {
    Object.assign(lynx.__initData, data);
  }

  destroyWorklet();
  snapshotInstanceManager.clear();
  __pendingListUpdates.clear();
  clearJSReadyEventIdSwap();

  const oldRoot = __root;
  setRoot(new SnapshotInstance('root'));
  __root.__jsx = oldRoot.__jsx;
  renderMainThread();
  hydrate(oldRoot as SnapshotInstance, __root as SnapshotInstance, {
    skipUnRef: true,
  });

  // always call this before `__FlushElementTree`
  __pendingListUpdates.flush();

  if (isJSReady) {
    __OnLifecycleEvent([
      LifecycleConstant.firstScreen, /* FIRST_SCREEN */
      {
        root: JSON.stringify(__root),
        refPatch: JSON.stringify(takeGlobalRefPatchMap()),
      },
    ]);
  }

  __FlushElementTree(__page, options);

  if (__PROFILE__) {
    console.profileEnd();
  }
  return;
}

function reloadBackground(updateData: Record<string, any>): void {
  if (__PROFILE__) {
    console.profile('reload');
  }

  deinitGlobalSnapshotPatch();

  destroyBackground();

  increaseReloadVersion();

  // COW when modify `lynx.__initData` to make sure Provider & Consumer works
  lynx.__initData = Object.assign({}, lynx.__initData, updateData);

  renderBackground(__root.__jsx, __root as any);

  if (__PROFILE__) {
    console.profileEnd();
  }
}

export { reloadBackground, reloadMainThread };
