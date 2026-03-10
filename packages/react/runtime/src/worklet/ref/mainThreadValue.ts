// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Use the registry from worklet-runtime to avoid global pollution
// and ensure we share the same registry instance/staging area.
import {
  WorkletEvents,
  loadWorkletRuntime,
  registerMainThreadValueClass,
} from '@lynx-js/react/worklet-runtime/bindings';
import type { WorkletRefImpl } from '@lynx-js/react/worklet-runtime/bindings';

import { addWorkletRefInitValue } from './workletRefPool.js';

// ID generators - split for testing purposes
let lastIdBG = 0;

let lastIdMT = 0;

declare let globDynamicComponentEntry: string | undefined;

/**
 * @internal
 */
export function clearMainThreadValueIdForTesting(): void {
  lastIdBG = lastIdMT = 0;
}

/**
 * Base class for main thread values.
 *
 * Third-party packages can extend this class to create their own main thread value types
 * that work seamlessly with the worklet system. The `__MT_PERSIST__` marker is automatically
 * added internally, so subclasses don't need to handle this.
 *
 * @example
 * ```typescript
 * // In a third-party package
 * import { MainThreadValue } from '@lynx-js/react';
 *
 * export class MotionValue<T> extends MainThreadValue<T> {
 *   get value(): T {
 *     // Main thread only - throws error on background thread
 *     return super.getValueOnMainThread();
 *   }
 *
 *   set value(v: T) {
 *     super.setValueOnMainThread(v);
 *   }
 *
 *   // Add custom methods
 *   subscribe(callback: (v: T) => void): () => void {
 *     // Implementation
 *   }
 * }
 * ```
 *
 * @public
 */
export abstract class MainThreadValue<T> {
  /**
   * @internal
   * Marker for runtime detection. Objects with this marker and a _wvid
   * will be automatically hydrated from the main thread value map.
   */
  readonly __MT_PERSIST__: true = true;

  /**
   * @internal
   * Unique ID for lifecycle management and cross-thread transfer.
   */
  protected _wvid: number;

  /**
   * @internal
   * Initial value for hydration on the main thread.
   */
  protected _initValue: T;

  /**
   * @internal
   * Type identifier for the main thread value.
   */
  protected _type: string;

  /**
   * @internal
   * Observer for garbage collection lifecycle.
   */
  protected _lifecycleObserver: unknown;

  /**
   * Create a new main thread value.
   *
   * @param initValue - The initial value
   * @param type - A string identifier for this type of main thread value
   */
  protected constructor(initValue: T, type: string = 'main-thread-value') {
    this._initValue = initValue;
    this._type = type;

    if (__JS__) {
      // Background thread: positive IDs, register with pool
      this._wvid = ++lastIdBG;
      addWorkletRefInitValue(this._wvid, initValue, type);

      // Set up lifecycle observer for cleanup
      const id = this._wvid;
      this._lifecycleObserver = lynx.getNativeApp().createJSObjectDestructionObserver?.(() => {
        lynx.getCoreContext?.().dispatchEvent({
          type: WorkletEvents.releaseWorkletRef,
          data: { id },
        });
      });
    } else {
      // Main thread (first screen): negative IDs
      this._wvid = --lastIdMT;
    }
  }

  /**
   * Register a custom MainThreadValue class.
   * This ensures the class is correctly hydrated on the main thread.
   *
   * @param Ctor - The class constructor
   * @param type - Unique type identifier (e.g. "@my-lib/MotionValue")
   */
  static register(Ctor: new(initValue: unknown, type: string) => unknown, type: string): void {
    if (__JS__) {
      return;
    }

    // Ensure the worklet runtime is loaded before registering.
    // This mirrors the behavior of registerWorkletInternal and resolves hydration issues
    // caused by order-dependent execution.
    const schema = typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry;
    loadWorkletRuntime(schema);

    // Delegate mapping to the worklet-runtime module
    registerMainThreadValueClass(Ctor, type);
  }
  /**
   * @internal
   * Serialization for cross-thread transfer.
   */
  toJSON(): { __MT_PERSIST__: true; _wvid: WorkletRefImpl<T>['_wvid']; _initValue: T; _type: string } {
    return {
      __MT_PERSIST__: true,
      _wvid: this._wvid,
      _initValue: this._initValue,
      _type: this._type,
    };
  }

  /**
   * Get the current value. Only callable on the main thread.
   * Subclasses should use this in their value getter.
   * @internal
   */
  protected getValueOnMainThread(): T {
    if (__JS__) {
      throw new Error(`${this._type}: value cannot be accessed on the background thread.`);
    }
    return this._initValue;
  }

  /**
   * Set the current value. Only callable on the main thread.
   * Subclasses should use this in their value setter.
   * @internal
   */
  protected setValueOnMainThread(val: T): void {
    if (__JS__) {
      throw new Error(`${this._type}: value cannot be set on the background thread.`);
    }
    this._initValue = val;
  }
}
