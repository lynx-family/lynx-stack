// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RefObject } from 'react';

import type { MutableCell, WorkletRefImpl } from '@lynx-js/react/worklet-runtime/bindings';

import { createWorkletValueHandleState } from './workletValueHandle.js';
import { clearWorkletValueIdsForTesting } from './workletValueId.js';
import { useMemo } from '../../../core/hooks/react.js';

export function clearWorkletRefLastIdForTesting(): void {
  clearWorkletValueIdsForTesting();
}

abstract class WorkletRef<T> {
  /** The realized target is always one stable mutable cell. @internal */
  declare private readonly _mutableCellTarget: MutableCell<T>;
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

  /**
   * @internal
   */
  protected constructor(initValue: T) {
    const state = createWorkletValueHandleState(initValue, {
      kind: 'mutable-cell',
    });
    this._initValue = state.initialValue;
    this._type = state.type;
    this._wvid = state.id;
    this._lifecycleObserver = state.lifecycleObserver;
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
 * A `MainThreadRef` is a ref that can only be accessed on the main thread. It is used to preserve
 * states between main thread function calls.
 * The data saved in `current` property of the `MainThreadRef` can be read and written in
 * multiple main thread functions.
 * @public
 */
export class MainThreadRef<T> extends WorkletRef<T> {
  constructor(initValue: T) {
    super(initValue);
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
