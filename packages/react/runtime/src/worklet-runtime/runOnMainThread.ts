// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { dispatchReloadScopedEvent } from '../core/reload-scoped-event.js';
import { WorkletEvents } from './bindings/index.js';
import type { ClosureValueType, RunWorkletCtxRetData, Worklet } from './bindings/index.js';

export function runRunOnMainThreadTask(task: Worklet, params: ClosureValueType[], resolveId: number): void {
  let returnValue;
  try {
    returnValue = runWorklet(task, params);
  } finally {
    // TODO: Should be more proper to reject the promise if there is an error.
    dispatchReloadScopedEvent(lynx.getJSContext(), {
      type: WorkletEvents.FunctionCallRet,
      data: {
        resolveId,
        returnValue,
      } as RunWorkletCtxRetData,
    });
  }
}
