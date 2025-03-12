// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Worklet } from '@lynx-js/react/worklet-runtime/bindings';

import { isMtsEnabled, isRunOnBackgroundEnabled } from './functionality.js';
import { registerWorkletCtx } from './runOnBackground.js';

/**
 * @internal
 */
export function onPostWorkletCtx(afterValue: Worklet | null): Worklet | null {
  if (!isMtsEnabled() && afterValue) {
    lynx.reportError(new Error('Main thread script requires Lynx sdk version 2.14'));
    return null;
  }
  if (!afterValue || !isRunOnBackgroundEnabled()) {
    return afterValue;
  }
  registerWorkletCtx(afterValue);
  return afterValue;
}
