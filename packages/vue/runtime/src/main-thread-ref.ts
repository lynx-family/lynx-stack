// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * MainThreadRef — a cross-thread value binding backed by a Vue `shallowRef`.
 *
 * On the Background Thread, `.value` is **reactive read-only** — reading
 * triggers Vue dependency tracking (via an internal `shallowRef`), but
 * writing is not allowed because there is no BG→MT sync channel yet.
 * This enables `watch(() => mtRef.value, cb)` for future MT→BG sync:
 * when MT pushes updates back, the shallowRef triggers Vue effects.
 *
 * On the Main Thread (inside a worklet function), `.current` resolves to the
 * actual PAPI element or state via the worklet-runtime's ref implementation.
 * `.current` is read-write on MT (worklet-runtime owns the value).
 *
 * The `_wvid` (worklet value id) bridges the two threads: the Background
 * Thread serializes it in the ops buffer, and the Main Thread's worklet-runtime
 * uses it to look up the real element handle in `lynxWorkletImpl._refImpl`.
 *
 * Both `.value` (Vue convention) and `.current` (worklet convention) are
 * provided on BG as read-only. Use `.current` inside `'main thread'`
 * functions for type compatibility with the worklet-runtime's hydrated refs.
 */

import { shallowRef } from '@vue/runtime-core';
import type { ShallowRef } from '@vue/runtime-core';

import { OP, pushOp } from './ops.js';

let nextWvid = 1;

export class MainThreadRef<T = unknown> {
  /** Worklet value id — used by the Main Thread worklet runtime to resolve. */
  readonly _wvid: number;

  /** Internal reactive ref for BG-side `.value` access. */
  private readonly _ref: ShallowRef<T>;

  constructor(initValue: T) {
    this._wvid = nextWvid++;
    this._ref = shallowRef(initValue) as ShallowRef<T>;
    // Push INIT_MT_REF op so the Main Thread registers this ref in
    // _workletRefMap before any worklet function tries to access it.
    // This is critical for value-only refs (not bound to elements) —
    // without this, the worklet-runtime resolves the _wvid to undefined.
    pushOp(OP.INIT_MT_REF, this._wvid, initValue);
  }

  /**
   * `.value` — reactive read-only on the Background Thread.
   * Reading triggers Vue dependency tracking (shallowRef).
   * Writing is blocked — no BG→MT sync channel exists yet.
   */
  get value(): T {
    return this._ref.value;
  }

  set value(_v: T) {
    if (__DEV__) {
      console.warn(
        '[vue-lynx] MainThreadRef.value is read-only on the Background Thread. '
          + 'Use .current inside main-thread functions to write.',
      );
    }
  }

  /**
   * `.current` — worklet convention alias, read-only on BG.
   * On the Main Thread, worklet-runtime replaces this object entirely,
   * so `.current` is read-write there. On BG it exists only for SWC
   * worklet transform compatibility.
   */
  get current(): T {
    return this._ref.value;
  }

  set current(_v: T) {
    if (__DEV__) {
      console.warn(
        '[vue-lynx] MainThreadRef.current is read-only on the Background Thread. '
          + 'Use .current inside main-thread functions to write.',
      );
    }
  }

  /** The initial value passed to useMainThreadRef(). */
  get _initValue(): T {
    return this._ref.value;
  }

  /** Serialize for cross-thread transfer (ops buffer JSON). */
  toJSON(): { _wvid: number; _initValue: T } {
    return { _wvid: this._wvid, _initValue: this._ref.value };
  }
}

/**
 * Create a MainThreadRef — a ref whose `.value` is reactive (read-only) on
 * the Background Thread and whose `.current` is read-write on the Main Thread
 * inside worklet functions.
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
