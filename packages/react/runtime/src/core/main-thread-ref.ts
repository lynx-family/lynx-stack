// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RefObject } from 'react';

import { useMemo } from './hooks/react.js';
import { addMainThreadRefInitValue } from './main-thread-ref-init-value.js';
import { WorkletEvents } from '../worklet-runtime/bindings/events.js';
import type { WorkletRefImpl } from '../worklet-runtime/bindings/types.js';

// Split into two variables for testing purposes.
let lastIdBG = 0;
let lastIdMT = 0;

export function clearMainThreadRefLastIdForTesting(): void {
  lastIdBG = lastIdMT = 0;
}

export function isMainThreadRef(value: unknown): value is WorkletRefImpl<unknown> {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { _wvid?: unknown })._wvid === 'number';
}

/**
 * A `MainThreadRef` is a ref that can only be accessed on the main thread. It is used to preserve
 * states between main thread function calls.
 * The data saved in `current` property of the `MainThreadRef` can be read and written in
 * multiple main thread functions.
 * @public
 */
export class MainThreadRef<T> {
  /**
   * @internal
   */
  protected _wvid: number;
  /**
   * @internal
   */
  protected _initValue: T | undefined;
  /**
   * @internal
   */
  protected _type: string;
  /**
   * @internal
   */
  protected _lifecycleObserver: unknown;

  constructor(initValue: T) {
    this._initValue = initValue;
    this._type = 'main-thread';
    if (__JS__) {
      this._wvid = ++lastIdBG;
      addMainThreadRefInitValue(this._wvid, initValue);
      const id = this._wvid;
      this._lifecycleObserver = lynx.getNativeApp().createJSObjectDestructionObserver?.(() => {
        lynx.getCoreContext?.().dispatchEvent({
          type: WorkletEvents.releaseWorkletRef,
          data: {
            id,
          },
        });
      });
    } else {
      this._wvid = --lastIdMT;
    }
  }

  get current(): T {
    if (__JS__ && __DEV__) {
      throw new Error('MainThreadRef: value of a MainThreadRef cannot be accessed in the background thread.');
    }
    if (__LEPUS__ && __DEV__) {
      /* v8 ignore next 3 */
      throw new Error('MainThreadRef: value of a MainThreadRef cannot be accessed outside of main thread script.');
    }
    return undefined as T;
  }

  set current(_: T) {
    if (__JS__ && __DEV__) {
      throw new Error('MainThreadRef: value of a MainThreadRef cannot be accessed in the background thread.');
    }
    if (__LEPUS__ && __DEV__) {
      throw new Error('MainThreadRef: value of a MainThreadRef cannot be accessed outside of main thread script.');
    }
  }

  /**
   * @internal
   */
  toJSON(): { _wvid: WorkletRefImpl<T>['_wvid'] } {
    return {
      _wvid: this._wvid,
    };
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

// Convenience overload for refs given as a ref prop as they typically start with a null value.
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

// Convenience overload for potentially undefined initialValue / call with 0 arguments
// has a default to stop it from defaulting to {} instead.
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
