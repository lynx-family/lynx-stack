// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RunWorkletCtxData, Worklet } from '@lynx-js/react/worklet-runtime/bindings';
import { WorkletEvents } from '@lynx-js/react/worklet-runtime/bindings';

import { onPostWorkletCtx } from './ctx.js';
import { isMtsEnabled } from './functionality.js';
import { onFunctionCall } from './functionCall.js';

/**
 * `runOnMainThread` allows triggering main thread functions on the main thread asynchronously.
 * @param fn - The main thread functions to be called.
 * @returns A function. Calling which with the arguments to be passed to the main thread function to trigger it on the main thread. This function returns a promise that resolves to the return value of the main thread function.
 * @example
 * ```ts
 * import { runOnMainThread } from '@lynx-js/react';
 *
 * async function someFunction() {
 *   const fn = runOnMainThread(() => {
 *     'main thread';
 *     return 'hello';
 *   });
 *   const result = await fn();
 * }
 * ```
 * @public
 */
export function runOnMainThread<R, Fn extends (...args: any[]) => R>(fn: Fn): (...args: Parameters<Fn>) => Promise<R> {
  if (__LEPUS__) {
    throw new Error('runOnMainThread can only be used on the background thread.');
  }
  if (!isMtsEnabled()) {
    throw new Error('runOnMainThread requires Lynx sdk version 2.14.');
  }
  return async (...params: any[]): Promise<R> => {
    return new Promise((resolve) => {
      onPostWorkletCtx(fn as any as Worklet);
      const resolveId = onFunctionCall(resolve);
      lynx.getCoreContext!().dispatchEvent({
        type: WorkletEvents.runWorkletCtx,
        data: JSON.stringify({
          worklet: fn as any as Worklet,
          params,
          resolveId,
        } as RunWorkletCtxData),
      });
    });
  };
}
