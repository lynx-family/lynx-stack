// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { WorkletEvents } from './bindings/events.js';
import type { ReleaseWorkletRefData, RunWorkletCtxData } from './bindings/events.js';
import type { ClosureValueType } from './bindings/types.js';
import { runRunOnMainThreadTask } from './runOnMainThread.js';
import type { Event } from './types/runtimeProxy.js';
import { removeValueFromWorkletRefMap } from './workletRef.js';

function initEventListeners(): void {
  const jsContext = lynx.getJSContext();
  jsContext.addEventListener(
    WorkletEvents.runWorkletCtx,
    (event: Event) => {
      const data = JSON.parse(event.data as string) as RunWorkletCtxData;
      runRunOnMainThreadTask(data.worklet, data.params as ClosureValueType[], data.resolveId);
    },
  );
  jsContext.addEventListener(
    WorkletEvents.releaseWorkletRef,
    (event: Event) => {
      removeValueFromWorkletRefMap((event.data as ReleaseWorkletRefData).id);
    },
  );
}

export { initEventListeners };
