// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * MainThreadRef — a cross-thread value binding, NOT a Vue reactive ref.
 *
 * On the Background Thread, `.value` returns the initial value (read-only).
 * On the Main Thread (inside a worklet function), `.value` resolves to the
 * actual PAPI element or state via the worklet-runtime's ref implementation.
 *
 * The `_wvid` (worklet value id) bridges the two threads: the Background
 * Thread serializes it in the ops buffer, and the Main Thread's worklet-runtime
 * uses it to look up the real element handle in `lynxWorkletImpl._refImpl`.
 *
 * The name follows React Lynx convention for worklet-runtime compatibility.
 * Both `.value` (Vue convention) and `.current` (worklet convention) are
 * provided. Use `.current` inside `'main thread'` functions for type
 * compatibility with the worklet-runtime's hydrated ref objects.
 */

import { OP, pushOp } from './ops.js';

let nextWvid = 1;

export class MainThreadRef<T = unknown> {
  /** Worklet value id — used by the Main Thread worklet runtime to resolve. */
  readonly _wvid: number;

  /** Initial value passed to useMainThreadRef(). */
  readonly _initValue: T;

  constructor(initValue: T) {
    this._wvid = nextWvid++;
    this._initValue = initValue;
    // Push INIT_MT_REF op so the Main Thread registers this ref in
    // _workletRefMap before any worklet function tries to access it.
    // This is critical for value-only refs (not bound to elements) —
    // without this, the worklet-runtime resolves the _wvid to undefined.
    pushOp(OP.INIT_MT_REF, this._wvid, initValue);
  }

  /**
   * `.value` access on the Background Thread.
   * Reading/writing is only meaningful on the Main Thread (inside a worklet).
   * On BG, get returns the init value; set is a no-op with a dev warning.
   */
  get value(): T {
    return this._initValue;
  }

  set value(_v: T) {
    if (__DEV__) {
      console.warn(
        '[vue-lynx] MainThreadRef.value is read-only on the Background Thread. '
          + 'Write to .value only inside <script main-thread> functions.',
      );
    }
  }

  /**
   * `.current` access — worklet convention alias for `.value`.
   * Use inside `'main thread'` functions where the worklet-runtime
   * hydrates refs with `.current` property.
   */
  get current(): T {
    return this._initValue;
  }

  set current(_v: T) {
    if (__DEV__) {
      console.warn(
        '[vue-lynx] MainThreadRef.current is read-only on the Background Thread. '
          + 'Write to .current only inside main-thread functions.',
      );
    }
  }

  /** Serialize for cross-thread transfer (ops buffer JSON). */
  toJSON(): { _wvid: number; _initValue: T } {
    return { _wvid: this._wvid, _initValue: this._initValue };
  }
}

/**
 * Create a MainThreadRef — a ref whose `.value` is accessible on the Main
 * Thread inside worklet functions.
 *
 * @param initValue - Initial value (typically `null` for element refs, or a
 *   primitive for shared state).
 *
 * @example
 * ```ts
 * const elRef = useMainThreadRef<ViewElement>(null)
 * // <view :main-thread-ref="elRef" />
 * ```
 */
export function useMainThreadRef<T>(initValue: T): MainThreadRef<T> {
  return new MainThreadRef<T>(initValue);
}

/** Reset module state — for testing only. */
export function resetMainThreadRefState(): void {
  nextWvid = 1;
}
