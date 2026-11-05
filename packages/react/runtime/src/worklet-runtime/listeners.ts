// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { onMessage } from '@lynx-js/lynx-runtime/mts';

import { WorkletEvents } from './bindings/events.js';
import type { ReleaseWorkletRefData, RunWorkletCtxData } from './bindings/events.js';
import type { ClosureValueType } from './bindings/types.js';
import { runRunOnMainThreadTask } from './runOnMainThread.js';
import { removeValueFromWorkletRefMap } from './workletRef.js';
import { onReloadScopedMessage } from '../core/reload-scoped-event.js';

function initEventListeners(): void {
  onReloadScopedMessage(onMessage, WorkletEvents.runWorkletCtx, (data: RunWorkletCtxData) => {
    runRunOnMainThreadTask(data.worklet, data.params as ClosureValueType[], data.resolveId);
  });
  onMessage<ReleaseWorkletRefData>(
    WorkletEvents.releaseWorkletRef,
    (data) => {
      removeValueFromWorkletRefMap(data.id);
    },
  );
}

export { initEventListeners };
