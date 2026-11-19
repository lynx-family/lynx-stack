// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { JsFnHandle } from './bindings/types.js';

interface Details {
  task: (fnId: number, execId: number) => void;

  // This comes from the background thread, inserted here during ctx hydration.
  jsFnHandle?: JsFnHandle;
}

interface RunOnBackgroundDelayImpl {
  // Elements should keep the order being called by the user.
  delayedBackgroundFunctionArray: Array<Details | undefined>;
  epoch: number;
  hasHydrated: boolean;
  clearDelayedBackgroundFunctions(): void;
  delayRunOnBackground(fnObj: JsFnHandle, fn: (fnId: number, execId: number) => void): void;
  runDelayedBackgroundFunctions(): void;
}

function initRunOnBackgroundDelay(): RunOnBackgroundDelayImpl {
  const pendingHandles = new Set<JsFnHandle>();
  function clearPendingDelayIndices(): void {
    for (const handle of pendingHandles) {
      delete handle._delayIndices;
    }
    pendingHandles.clear();
  }
  const instance: RunOnBackgroundDelayImpl = {
    delayedBackgroundFunctionArray: [],
    epoch: 0,
    hasHydrated: false,
    clearDelayedBackgroundFunctions(): void {
      instance.epoch++;
      instance.hasHydrated = false;
      clearPendingDelayIndices();
      // PrimJS can keep truncated array storage alive; drop the consumed queue so
      // its tasks and hydrated handles stop retaining their background executions.
      instance.delayedBackgroundFunctionArray = [];
    },
    delayRunOnBackground(fnObj: JsFnHandle, task: (fnId: number, execId: number) => void): void {
      if (instance.hasHydrated) {
        return;
      }
      pendingHandles.add(fnObj);
      instance.delayedBackgroundFunctionArray.push({ task });
      const delayIndices = fnObj._delayIndices ??= [];
      delayIndices.push(instance.delayedBackgroundFunctionArray.length - 1);
    },
    runDelayedBackgroundFunctions(): void {
      const queue = instance.delayedBackgroundFunctionArray;
      instance.delayedBackgroundFunctionArray = [];
      instance.hasHydrated = true;
      clearPendingDelayIndices();
      for (const details of queue) {
        if (details?.jsFnHandle) {
          details.task(details.jsFnHandle._jsFnId!, details.jsFnHandle._execId!);
        }
      }
    },
  };
  return instance;
}

export { type RunOnBackgroundDelayImpl, initRunOnBackgroundDelay };
