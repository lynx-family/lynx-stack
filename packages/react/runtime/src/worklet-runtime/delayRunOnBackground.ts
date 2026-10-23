// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { JsFnHandle } from './bindings/types.js';

interface Details {
  task: (fnId: number, execId: number) => void;

  // Hydration binds the same local object already owned by the caller.
  jsFnHandle: JsFnHandle;
}

interface RunOnBackgroundDelayImpl {
  // Elements should keep the order being called by the user.
  delayedBackgroundFunctionArray: Details[];
  clearDelayedBackgroundFunctions(): void;
  delayRunOnBackground(fnObj: JsFnHandle, fn: (fnId: number, execId: number) => void): void;
  runDelayedBackgroundFunctions(): void;
}

let impl: RunOnBackgroundDelayImpl | undefined;

function initRunOnBackgroundDelay(): RunOnBackgroundDelayImpl {
  return (impl = {
    delayedBackgroundFunctionArray: [],
    clearDelayedBackgroundFunctions,
    delayRunOnBackground,
    runDelayedBackgroundFunctions,
  });
}

function delayRunOnBackground(fnObj: JsFnHandle, task: (fnId: number, execId: number) => void) {
  impl!.delayedBackgroundFunctionArray.push({ task, jsFnHandle: fnObj });
}

function clearDelayedBackgroundFunctions(): void {
  // PrimJS can keep truncated array storage alive; drop the consumed queue so
  // its tasks and hydrated handles stop retaining their background executions.
  impl!.delayedBackgroundFunctionArray = [];
}

function runDelayedBackgroundFunctions(): void {
  for (const details of impl!.delayedBackgroundFunctionArray) {
    if (!details.jsFnHandle._isFirstScreen) {
      details.task(details.jsFnHandle._jsFnId!, details.jsFnHandle._execId!);
    }
  }
  clearDelayedBackgroundFunctions();
}

export { type RunOnBackgroundDelayImpl, initRunOnBackgroundDelay };
