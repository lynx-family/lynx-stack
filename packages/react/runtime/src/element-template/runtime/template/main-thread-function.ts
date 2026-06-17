// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  createRunOnMainThread,
  takeDelayedRunOnMainThreadData,
} from '../../../core/thread-function-call/main-thread.js';
import { resetFunctionCallReturnListener } from '../../../core/thread-function-call/return-value.js';
import { isElementTemplateHydrated } from '../../background/commit-hook.js';
import { isElementTemplateRendering } from '../../background/render-scope.js';

const runOnMainThreadImpl = createRunOnMainThread({
  shouldDispatchRunOnMainThreadDirectly() {
    return isElementTemplateHydrated() && !isElementTemplateRendering();
  },
});

/**
 * `runOnMainThread` allows triggering main-thread functions on the main thread asynchronously.
 * @public
 */
export function runOnMainThread<R, Fn extends (...args: any[]) => R>(
  fn: Fn,
): (...args: Parameters<Fn>) => Promise<R> {
  return runOnMainThreadImpl(fn);
}

export function resetElementTemplateMainThreadFunctionRuntime(): void {
  takeDelayedRunOnMainThreadData();
  resetFunctionCallReturnListener();
}
