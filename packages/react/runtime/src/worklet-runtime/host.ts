// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './global.js';

import { initApiEnv } from './api/lynxApi.js';
import { initEventListeners } from './listeners.js';
import { initWorklet } from './workletRuntime.js';

function ensureHostWorkletRuntime(): boolean {
  if (globalThis.lynxWorkletImpl) {
    return true;
  }

  initWorklet();
  initApiEnv();
  initEventListeners();

  return true;
}

export { ensureHostWorkletRuntime };
