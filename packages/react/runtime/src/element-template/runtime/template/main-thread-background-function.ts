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
import { isRunOnBackgroundEnabled } from '../../../worklet-runtime/jsFunctionLifecycle.js';

type BackgroundFunctionCtx = Parameters<typeof registerBackgroundFunctionCtx>[0];
type RetainableMainThreadCtx = Parameters<typeof retainWorkletCtx>[0];

interface MTEventBackgroundFunctionCtx {
  _wkltId: string;
  [key: string]: unknown;
}

/**
 * @internal transform-generated runtime helper for background JS function handles.
 */
export const transformToWorklet = createBackgroundFunctionHandle;
export { runOnBackground };

export function registerMTEventBackgroundFunctionCtx(ctx: MTEventBackgroundFunctionCtx): void {
  if (__JS__ && isRunOnBackgroundEnabled()) {
    registerBackgroundFunctionCtx(ctx as BackgroundFunctionCtx);
  }
}

export function retainMTEventBackgroundFunctionCtx(ctx: MTEventBackgroundFunctionCtx): void {
  retainWorkletCtx(ctx as RetainableMainThreadCtx);
}

export function resetElementTemplateBackgroundFunctionRuntime(): void {
  resetBackgroundFunctionRuntime();
  resetFunctionCallReturnListener();
}

export function resetElementTemplateMainThreadBackgroundFunctionRuntime(): void {
  clearDelayedRunOnBackgroundFunctions();
  resetFunctionCallReturnListener();
}
