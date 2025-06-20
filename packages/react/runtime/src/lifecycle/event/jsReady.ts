// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { LifecycleConstant } from '../../lifecycleConstant.js';
import { __root } from '../../root.js';

let isJSReady: boolean;
let jsReadyEventIdSwap: Record<string | number, number>;

function jsReady(): void {
  isJSReady = true;
  __OnLifecycleEvent([
    LifecycleConstant.firstScreen, /* FIRST_SCREEN */
    {
      root: JSON.stringify(__root),
      jsReadyEventIdSwap,
    },
  ]);
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
