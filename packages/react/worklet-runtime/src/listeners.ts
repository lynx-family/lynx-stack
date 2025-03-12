// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { WorkletEvents } from './bindings/events.js';
import type { RunWorkletCtxData, RunWorkletCtxRetData } from './bindings/events.js';
import type { ClosureValueType } from './bindings/types.js';
import { removeValueFromWorkletRefMap } from './workletRef.js';

function initEventListeners(): void {
  const jsContext = lynx.getJSContext();
  jsContext.addEventListener(
    WorkletEvents.runWorkletCtx,
    (event: RuntimeProxy.Event) => {
      const data = JSON.parse(event.data as string) as RunWorkletCtxData;
      const returnValue = runWorklet(data.worklet, data.params as ClosureValueType[]);
      jsContext.dispatchEvent({
        type: WorkletEvents.FunctionCallRet,
        data: JSON.stringify({
          resolveId: data.resolveId,
          returnValue,
        } as RunWorkletCtxRetData),
      });
    },
  );
  jsContext.addEventListener(
    WorkletEvents.releaseWorkletRef,
    (event: RuntimeProxy.Event) => {
      removeValueFromWorkletRefMap(event.data.id);
    },
  );
}

export { initEventListeners };
