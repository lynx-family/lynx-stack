// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { JsFnHandle } from '../../worklet-runtime/bindings/types.js';

let lastId = 0;

/**
 * Creates the serializable handle used by main-thread code to call a background function.
 */
export function createBackgroundFunctionHandle(
  obj: ((...args: any[]) => any) & { toJSON?: () => string },
): JsFnHandle {
  const id = ++lastId;
  if (typeof obj !== 'function') {
    return {
      _jsFnId: id,
      _error: `Argument of runOnBackground should be a function, but got [${typeof obj}] instead`,
    };
  }
  obj.toJSON ??= () => '[BackgroundFunction]';
  return {
    _jsFnId: id,
    _fn: obj,
  };
}

export function resetBackgroundFunctionHandleIdForTesting(): void {
  lastId = 0;
}
