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
  delayedBackgroundFunctionArray: Details[];
  delayRunOnBackground(fnObj: JsFnHandle, fn: (fnId: number, execId: number) => void): void;
  runDelayedBackgroundFunctions(): void;
}

let impl: RunOnBackgroundDelayImpl | undefined;

function initRunOnBackgroundDelay(): RunOnBackgroundDelayImpl {
  return (impl = {
    delayedBackgroundFunctionArray: [],
    delayRunOnBackground,
    runDelayedBackgroundFunctions,
  });
}

function delayRunOnBackground(fnObj: JsFnHandle, task: (fnId: number, execId: number) => void) {
  impl!.delayedBackgroundFunctionArray.push({ task });
  const delayIndices = fnObj._delayIndices ??= [];
  delayIndices.push(impl!.delayedBackgroundFunctionArray.length - 1);
}

function runDelayedBackgroundFunctions(): void {
  for (const details of impl!.delayedBackgroundFunctionArray) {
    if (details.jsFnHandle) {
      details.task(details.jsFnHandle._jsFnId!, details.jsFnHandle._execId!);
    }
  }
  impl!.delayedBackgroundFunctionArray.length = 0;
}

export { type RunOnBackgroundDelayImpl, initRunOnBackgroundDelay };
