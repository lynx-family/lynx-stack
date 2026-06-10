// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { __root } from '../../../root.js';
import { profileEnd, profileStart } from '../../../shared/profile.js';
import { LifecycleConstant } from '../../lifecycle/constant.js';

let isFirstScreenSynced: boolean;
let firstScreenEventIdSwap: Record<string | number, number>;

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

function clearFirstScreenEventIdSwap(): void {
  firstScreenEventIdSwap = {};
}

function resetFirstScreenSyncState(): void {
  isFirstScreenSynced = false;
  firstScreenEventIdSwap = {};
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
};
