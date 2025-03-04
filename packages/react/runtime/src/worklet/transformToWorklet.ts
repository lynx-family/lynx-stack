// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { JsFnHandle } from '@lynx-js/react/worklet-runtime/bindings';

let lastId = 0;

/**
 * transform args of `runOnBackground()`.
 *
 * @internal
 */
export function transformToWorklet(obj: (...args: any[]) => any): JsFnHandle {
  const id = ++lastId;
  if (typeof obj !== 'function') {
    // We save the error message in the object, so that we can throw it later when the function is called on the main thread.
    return {
      _jsFnId: id,
      _error: `Argument of runOnBackground should be a function, but got [${typeof obj}] instead`,
    };
  }
  return {
    _jsFnId: id,
    _fn: obj,
  };
}
