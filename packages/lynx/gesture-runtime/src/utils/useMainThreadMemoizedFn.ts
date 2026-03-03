// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { runOnMainThread, useMainThreadRef, useMemo } from '@lynx-js/react';
import { runWorkletCtx } from '@lynx-js/react/worklet-runtime/bindings';

type noop = (this: unknown, ...args: unknown[]) => unknown;

type PickFunction<T extends noop> = (
  this: ThisParameterType<T>,
  ...args: Parameters<T>
) => ReturnType<T>;

/**
 * @internal
 * Hooks for persistent main thread functions.
 * It ensures the returned function has a stable reference while always executing the latest logic on the main thread.
 * @example
 * ```tsx
 * const handleScroll = useMainThreadMemoizedFn((e: MainThread.TouchEvent) => {
 *   'main thread';
 *   console.log(count); // Access captured variable
 * });
 * ```
 */
export function useMainThreadMemoizedFn<T extends noop>(fn: T): T {
  // Create a ref on the main thread to hold the function
  const fnMTRef = useMainThreadRef<T>(fn);

  // Synchronize the latest function to the main thread ref during render
  useMemo(() => {
    if (__MAIN_THREAD__) {
      /* v8 ignore next 5 */
      // @ts-expect-error - This is a worklet context, we can directly assign to the ref
      runWorkletCtx(() => {
        'main thread';
        fnMTRef.current = fn;
      }, []);
    } else {
      /* v8 ignore next 4 */
      void runOnMainThread((latestFn: T) => {
        'main thread';
        fnMTRef.current = latestFn;
      })(fn);
    }
  }, [fn]);

  // Return a stable wrapper function
  const memoizedFn = useMemo<PickFunction<T>>(() => {
    /* v8 ignore next 10 */
    return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
      'main thread';
      // Call the latest function stored in the ref
      const currentFn = fnMTRef.current;
      if (currentFn) {
        return currentFn.apply(this, args) as ReturnType<T>;
      }
      return undefined as ReturnType<T>;
    };
  }, []);

  return memoizedFn as unknown as T;
}
