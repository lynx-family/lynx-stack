// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RunWorkletCtxData, Worklet } from '@lynx-js/react/worklet-runtime/bindings';
import { WorkletEvents } from '@lynx-js/react/worklet-runtime/bindings';

import { onPostWorkletCtx } from './ctx.js';
import { lynxWorkletJsImpl } from './jsImpl.js';

/**
 * `runOnMainThread` allows triggering main thread functions on the main thread asynchronously.
 * @param fn - The main thread functions to be called.
 * @returns A function. Calling which with the arguments to be passed to the main thread function to trigger it on the main thread.
 * @public
 */
export function runOnMainThread<Fn extends (...args: any[]) => any>(fn: Fn): (...args: Parameters<Fn>) => void {
  if (__LEPUS__) {
    throw new Error('runOnMainThread can only be used on the background thread.');
  }
  const impl = lynxWorkletJsImpl();
  if (!impl) {
    throw new Error('runOnMainThread requires Lynx sdk version 2.14.');
  }
  return (...params: any[]): void => {
    onPostWorkletCtx(fn as any as Worklet);
    lynx.getCoreContext!().dispatchEvent({
      type: WorkletEvents.runWorkletCtx,
      data: JSON.stringify({
        worklet: fn as any as Worklet,
        params,
      } as RunWorkletCtxData),
    });
  };
}
