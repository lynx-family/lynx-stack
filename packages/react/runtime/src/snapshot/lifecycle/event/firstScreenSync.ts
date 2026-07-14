// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { resetHydrationState } from '../../../core/hydration.js';
import { isProcessingDefaultData } from '../../../core/lynx-data-processors.js';
import { __root } from '../../../root.js';
import { profileEnd, profileStart } from '../../../shared/profile.js';
import { LifecycleConstant } from '../../lifecycle/constant.js';

// Initialized once at module load (`renderPage` runs once per runtime and does
// not reset), so a ready mark set before `renderPage` (e.g. in `defaultDataProcessor`)
// survives. In `'manual'` mode the first screen syncs only after both are true.
let isFirstScreenSynced = false;
let firstScreenEventIdSwap: Record<string | number, number> = {};
let isMarkedFirstScreenSyncReady = false;
let isFirstScreenTreeReady = false;

// Set by `root.render(jsx, { hydrate: false })` (which runs on both threads
// before `renderPage`): the framework must not hand over the UI to the
// background thread on its own; the handover waits for `root.hydrate()`.
let isAutoHydrateDisabled = false;

function disableAutoHydrate(): void {
  isAutoHydrateDisabled = true;
}

// Whether the handover is held for an explicit `root.hydrate()` call, either
// through the `firstScreenSyncTiming: 'manual'` preset or through
// `root.render(jsx, { hydrate: false })`.
function isHydrationHeld(): boolean {
  return isAutoHydrateDisabled || __FIRST_SCREEN_SYNC_TIMING__ === 'manual';
}

function syncFirstScreen(): void {
  isFirstScreenSynced = true;

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
      firstScreenEventIdSwap,
    },
  ]);
  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileEnd();
  }
  firstScreenEventIdSwap = {};
}

// ready signal: business/framework allows the handover. Syncs if the tree is ready.
function onFirstScreenSyncReady(): void {
  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileStart('ReactLynx::onFirstScreenSyncReady');
  }
  isMarkedFirstScreenSyncReady = true;
  // A mark made inside `defaultDataProcessor` (a native call before the upcoming render)
  // is recorded but not synced now; `onFirstScreenTreeReady` honors it once render ends.
  if (isFirstScreenTreeReady && !isProcessingDefaultData() && !isFirstScreenSynced) {
    syncFirstScreen();
  }
  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileEnd();
  }
}

// tree built (`renderPage` / `updatePage` done). Syncs if the ready signal already came.
function onFirstScreenTreeReady(): void {
  isFirstScreenTreeReady = true;
  if (isMarkedFirstScreenSyncReady && !isFirstScreenSynced) {
    syncFirstScreen();
  }
}

// the first-screen tree is being (re-)rendered, a mark during this period
// must not sync until the next `onFirstScreenTreeReady`
function resetFirstScreenTreeReady(): void {
  isFirstScreenTreeReady = false;
}

function clearFirstScreenEventIdSwap(): void {
  firstScreenEventIdSwap = {};
}

// Full reset of all first-screen state. Used by SSR hydration to re-initialize.
function resetFirstScreenSyncState(): void {
  isFirstScreenSynced = false;
  firstScreenEventIdSwap = {};
  isMarkedFirstScreenSyncReady = false;
  isFirstScreenTreeReady = false;
  isAutoHydrateDisabled = false;
  resetHydrationState();
}

/**
 * @internal
 */
export {
  syncFirstScreen,
  isFirstScreenSynced,
  firstScreenEventIdSwap,
  clearFirstScreenEventIdSwap,
  resetFirstScreenSyncState,
  onFirstScreenSyncReady,
  onFirstScreenTreeReady,
  resetFirstScreenTreeReady,
  disableAutoHydrate,
  isHydrationHeld,
};
