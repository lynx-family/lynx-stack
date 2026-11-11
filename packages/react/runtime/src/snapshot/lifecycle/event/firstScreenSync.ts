// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { cardLifetime } from '../../../core/card-lifetime.js';
import { isProcessingDefaultData } from '../../../core/lynx-data-processors.js';
import { __root } from '../../../root.js';
import { profileEnd, profileStart } from '../../../shared/profile.js';
import { LifecycleConstant } from '../../lifecycle/constant.js';

// Initialized once at module load (`renderPage` runs once per runtime and does
// not reset), so a ready mark set before `renderPage` (e.g. in `defaultDataProcessor`)
// survives. In `'manual'` mode the first screen syncs only after both are true.
const firstScreenSync: {
  isSynced: boolean;
  eventIdSwap: Record<string | number, number>;
  isMarkedReady: boolean;
  isTreeReady: boolean;
} = /*#__PURE__*/ cardLifetime('firstScreenSync', () => ({
  isSynced: false,
  eventIdSwap: {},
  isMarkedReady: false,
  isTreeReady: false,
}));

function syncFirstScreen(): void {
  firstScreenSync.isSynced = true;

  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileStart('ReactLynx::serializeRoot');
  }
  const root = JSON.stringify(__root);
  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileEnd();
  }
  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileStart('ReactLynx::transferRoot');
  }
  __OnLifecycleEvent([
    LifecycleConstant.firstScreen, /* FIRST_SCREEN */
    {
      root,
      firstScreenEventIdSwap: firstScreenSync.eventIdSwap,
    },
  ]);
  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileEnd();
  }
  firstScreenSync.eventIdSwap = {};
}

// ready signal: business/framework allows the handover. Syncs if the tree is ready.
function onFirstScreenSyncReady(): void {
  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileStart('ReactLynx::onFirstScreenSyncReady');
  }
  firstScreenSync.isMarkedReady = true;
  // A mark made inside `defaultDataProcessor` (a native call before the upcoming render)
  // is recorded but not synced now; `onFirstScreenTreeReady` honors it once render ends.
  if (firstScreenSync.isTreeReady && !isProcessingDefaultData() && !firstScreenSync.isSynced) {
    syncFirstScreen();
  }
  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileEnd();
  }
}

// tree built (`renderPage` / `updatePage` done). Syncs if the ready signal already came.
function onFirstScreenTreeReady(): void {
  firstScreenSync.isTreeReady = true;
  if (firstScreenSync.isMarkedReady && !firstScreenSync.isSynced) {
    syncFirstScreen();
  }
}

// the first-screen tree is being (re-)rendered, a mark during this period
// must not sync until the next `onFirstScreenTreeReady`
function resetFirstScreenTreeReady(): void {
  firstScreenSync.isTreeReady = false;
}

function clearFirstScreenEventIdSwap(): void {
  firstScreenSync.eventIdSwap = {};
}

// Full reset of all first-screen state. Used by SSR hydration to re-initialize.
function resetFirstScreenSyncState(): void {
  firstScreenSync.isSynced = false;
  firstScreenSync.eventIdSwap = {};
  firstScreenSync.isMarkedReady = false;
  firstScreenSync.isTreeReady = false;
}

/**
 * @internal
 */
export {
  syncFirstScreen,
  firstScreenSync,
  clearFirstScreenEventIdSwap,
  resetFirstScreenSyncState,
  onFirstScreenSyncReady,
  onFirstScreenTreeReady,
  resetFirstScreenTreeReady,
};
