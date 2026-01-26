// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RefObject } from 'react';

import { MainThreadValue, clearMainThreadValueIdForTesting } from './mainThreadValue.js';
import { useMemo } from '../../hooks/react.js';

export function clearWorkletRefLastIdForTesting(): void {
  clearMainThreadValueIdForTesting();
}

/**
 * A `MainThreadRef` is a ref that can only be accessed on the main thread. It is used to preserve
 * states between main thread function calls.
 * The data saved in `current` property of the `MainThreadRef` can be read and written in
 * multiple main thread functions.
 * @public
 */
export class MainThreadRef<T> extends MainThreadValue<T> {
  constructor(initValue: T) {
    super(initValue, 'main-thread');
  }

  get current(): T {
    try {
      return this.getValueOnMainThread();
    } catch {
      // For backward compatibility / safety in background thread (though it throws in base)
      // The base class throws if on BG.
      // The original MainThreadRef threw on BG in DEV.
      // Base class throws Error.
      return super.getValueOnMainThread();
    }
  }

  set current(val: T) {
    this.setValueOnMainThread(val);
  }
}

/**
 * Create A `MainThreadRef`.
 *
 * A `MainThreadRef` is a ref that can only be accessed on the main thread. It is used to preserve
 * states between main thread function calls.
 * The data saved in `current` property of the `MainThreadRef` can be read and written in
 * multiple main thread functions.
 *
 * It is a hook and it should only be called at the top level of your component.
 *
 * @param initValue - The init value of the `MainThreadRef`.
 *
 * @example
 *
 * ```ts
 * import { useMainThreadRef } from '@lynx-js/react'
 * import type { MainThread } from '@lynx-js/types'
 *
 * export function App() {
 *   const ref = useMainThreadRef<MainThread.Element>(null)
 *
 *   const handleTap = () => {
 *     'main thread'
 *     ref.current?.setStyleProperty('background-color', 'blue')
 *   }
 *
 *   return (
 *     <view
 *       main-thread:ref={ref}
 *       main-thread:bindtap={handleTap}
 *       style={{ width: '300px', height: '300px' }}
 *     />
 *   )
 * }
 * ```
 *
 * @public
 */
export function useMainThreadRef<T>(initValue: T): MainThreadRef<T>;

// convenience overload for refs given as a ref prop as they typically start with a null value
/**
 * Create A `MainThreadRef`.
 *
 * A `MainThreadRef` is a ref that can only be accessed on the main thread. It is used to preserve
 * states between main thread function calls.
 * The data saved in `current` property of the `MainThreadRef` can be read and written in
 * multiple main thread functions.
 *
 * It is a hook and it should only be called at the top level of your component.
 *
 * @param initValue - The init value of the `MainThreadRef`.
 *
 * @example
 *
 * ```ts
 * import { useMainThreadRef } from '@lynx-js/react'
 * import type { MainThread } from '@lynx-js/types'
 *
 * export function App() {
 *   const ref = useMainThreadRef<MainThread.Element>(null)
 *
 *   const handleTap = () => {
 *     'main thread'
 *     ref.current?.setStyleProperty('background-color', 'blue')
 *   }
 *
 *   return (
 *     <view
 *       main-thread:ref={ref}
 *       main-thread:bindtap={handleTap}
 *       style={{ width: '300px', height: '300px' }}
 *     />
 *   )
 * }
 * ```
 *
 * @public
 */
export function useMainThreadRef<T>(initValue: T | null): RefObject<T>;

// convenience overload for potentially undefined initialValue / call with 0 arguments
// has a default to stop it from defaulting to {} instead
/**
 * Create A `MainThreadRef`.
 *
 * A `MainThreadRef` is a ref that can only be accessed on the main thread. It is used to preserve
 * states between main thread function calls.
 * The data saved in `current` property of the `MainThreadRef` can be read and written in
 * multiple main thread functions.
 *
 * It is a hook and it should only be called at the top level of your component.
 *
 * @example
 *
 * ```ts
 * import { useMainThreadRef } from '@lynx-js/react'
 * import type { MainThread } from '@lynx-js/types'
 *
 * export function App() {
 *   const ref = useMainThreadRef<MainThread.Element>(null)
 *
 *   const handleTap = () => {
 *     'main thread'
 *     ref.current?.setStyleProperty('background-color', 'blue')
 *   }
 *
 *   return (
 *     <view
 *       main-thread:ref={ref}
 *       main-thread:bindtap={handleTap}
 *       style={{ width: '300px', height: '300px' }}
 *     />
 *   )
 * }
 * ```
 *
 * @public
 */
export function useMainThreadRef<T = undefined>(): MainThreadRef<T | undefined>;

export function useMainThreadRef<T>(initValue?: T): MainThreadRef<T | undefined> {
  return useMemo(() => {
    return new MainThreadRef(initValue);
  }, []);
}
