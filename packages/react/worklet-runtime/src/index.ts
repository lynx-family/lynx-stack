// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { initApiEnv } from '../../runtime/src/worklet-runtime/api/lynxApi.js';
import { initEventListeners } from '../../runtime/src/worklet-runtime/listeners.js';
import { initWorklet } from '../../runtime/src/worklet-runtime/workletRuntime.js';

if (globalThis.lynxWorkletImpl === undefined) {
  initWorklet();
  initApiEnv();
  initEventListeners();
}
