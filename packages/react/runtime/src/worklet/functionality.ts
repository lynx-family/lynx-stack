// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { isSdkVersionGt } from '../utils.js';

let mtsEnabled: boolean | undefined;
let runOnBackgroundEnabled: boolean | undefined;

/**
 * @internal
 */
function isMtsEnabled(): boolean {
  return mtsEnabled ??= isSdkVersionGt(2, 13);
}

/**
 * @internal
 */
function isRunOnBackgroundEnabled(): boolean {
  return runOnBackgroundEnabled ??= isSdkVersionGt(2, 15);
}

function clearConfigCacheForTesting(): void {
  mtsEnabled = undefined;
  runOnBackgroundEnabled = undefined;
}

export { isMtsEnabled, isRunOnBackgroundEnabled, clearConfigCacheForTesting };
