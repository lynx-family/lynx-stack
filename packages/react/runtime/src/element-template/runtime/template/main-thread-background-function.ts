// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { clearDelayedRunOnBackgroundFunctions, retainWorkletCtx } from '@lynx-js/react/worklet-runtime/bindings';

import { createBackgroundFunctionHandle } from '../../../core/background-function/handle.js';
import {
  registerBackgroundFunctionCtx,
  resetBackgroundFunctionRuntime,
  runOnBackground,
} from '../../../core/background-function/run-on-background.js';
import { resetFunctionCallReturnListener } from '../../../core/thread-function-call/return-value.js';
import type { Worklet } from '../../../worklet-runtime/bindings/types.js';
import { JsFunctionLifecycleManager, isRunOnBackgroundEnabled } from '../../../worklet-runtime/jsFunctionLifecycle.js';

type BackgroundFunctionCtx = Parameters<typeof registerBackgroundFunctionCtx>[0];
type RetainableMainThreadCtx = Parameters<typeof retainWorkletCtx>[0];

interface MainThreadBackgroundFunctionCtx {
  _wkltId: string;
  [key: string]: unknown;
}

/**
 * @internal transform-generated runtime helper for background JS function handles.
 */
export const transformToWorklet = createBackgroundFunctionHandle;
export { runOnBackground };

export function registerMainThreadBackgroundFunctionCtx(ctx: MainThreadBackgroundFunctionCtx): void {
  if (__JS__ && isRunOnBackgroundEnabled()) {
    registerBackgroundFunctionCtx(ctx as BackgroundFunctionCtx);
  }
}

// Native clones descriptors, so establish lookup identity before crossing that boundary.
// Track the prepared input even if Native rejects it: collecting that input must
// still release its already-registered background execution. Slot ownership commits later.
export function prepareMainThreadBackgroundFunctionCtx(ctx: MainThreadBackgroundFunctionCtx): void {
  const manager = globalThis.lynxWorkletImpl?._jsFunctionLifecycleManager;
  manager?.prepareWorkletCtx(ctx as Worklet);
  retainMainThreadBackgroundFunctionCtx(ctx);
}

export function retainMainThreadBackgroundFunctionCtx(ctx: MainThreadBackgroundFunctionCtx): void {
  retainWorkletCtx(ctx as RetainableMainThreadCtx);
}

export function resetElementTemplateBackgroundFunctionRuntime(): void {
  resetBackgroundFunctionRuntime();
  resetFunctionCallReturnListener();
}

export function resetElementTemplateMainThreadBackgroundFunctionRuntime(): void {
  const manager = globalThis.lynxWorkletImpl?._jsFunctionLifecycleManager;
  if (manager) {
    manager.dispose();
    globalThis.lynxWorkletImpl._jsFunctionLifecycleManager = new JsFunctionLifecycleManager(manager);
  }
  clearDelayedRunOnBackgroundFunctions();
  resetFunctionCallReturnListener();
}
