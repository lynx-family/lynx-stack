// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { profileEnd, profileStart } from '../../debug/utils.js';
import { LifecycleConstant } from '../../lifecycleConstant.js';
import { __root } from '../../root.js';

let isJSReady: boolean;
let jsReadyEventIdSwap: Record<string | number, number>;

function jsReady(): void {
  isJSReady = true;

  if (__PROFILE__) {
    profileStart('ReactLynx::transferRoot');
    profileStart('ReactLynx::serializeRoot');
  }
  const root = JSON.stringify(__root);
  if (__PROFILE__) {
    profileEnd();
  }
  __OnLifecycleEvent([
    LifecycleConstant.firstScreen, /* FIRST_SCREEN */
    {
      root,
      jsReadyEventIdSwap,
    },
  ]);
  if (__PROFILE__) {
    profileEnd();
  }
  jsReadyEventIdSwap = {};
}

function clearJSReadyEventIdSwap(): void {
  jsReadyEventIdSwap = {};
}

function resetJSReady(): void {
  isJSReady = false;
  jsReadyEventIdSwap = {};
}

/**
 * @internal
 */
export { jsReady, isJSReady, jsReadyEventIdSwap, clearJSReadyEventIdSwap, resetJSReady };
