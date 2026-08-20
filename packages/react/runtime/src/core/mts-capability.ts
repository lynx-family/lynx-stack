// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { isSdkVersionGt } from '../utils.js';

let mtsEnabled: boolean | undefined;

/**
 * @internal
 */
export function isMtsEnabled(): boolean {
  return mtsEnabled ??= isSdkVersionGt(2, 13);
}

/**
 * @internal
 */
export function clearMtsConfigCacheForTesting(): void {
  mtsEnabled = undefined;
}
