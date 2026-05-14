// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { initApiEnv } from './api/lynxApi.js';
import { initEventListeners } from './listeners.js';
import { initWorklet } from './workletRuntime.js';

if (
  typeof lynx.querySelector !== 'function'
  || typeof lynx.querySelectorAll !== 'function'
) {
  initApiEnv();
}

if (globalThis.lynxWorkletImpl === undefined) {
  initWorklet();
  initEventListeners();
}
