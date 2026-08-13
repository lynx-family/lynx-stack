// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  WorkletEvents,
  loadWorkletRuntime,
  registerMainThreadValueType,
} from '@lynx-js/react/worklet-runtime/bindings';
import type { WorkletRefImpl } from '@lynx-js/react/worklet-runtime/bindings';

import { addMainThreadRefInitValue } from '../../../core/main-thread-ref-init-value.js';
import { allocateWorkletValueId } from './workletValueId.js';

/**
 * An opaque handle for a value that is created and retained on the main thread.
 *
 * Library authors should subclass this handle and register a factory for the
 * main-thread implementation. The handle itself must only be captured by main
 * thread functions; it does not expose the main-thread implementation on the
 * background thread.
 *
 * Registration must run in the main-thread render. Hooks that create a handle
 * should register their factory from the hook body rather than relying only on
 * module initialization.
 *
 * @public
 */
export abstract class MainThreadValue<T> {
  /** @internal */
  readonly __MAIN_THREAD_VALUE__: true = true;
  /** @internal */
  protected _wvid: number;
  /** @internal */
  protected _initValue: T;
  /** @internal */
  protected _type: string;
  /** @internal */
  protected _lifecycleObserver?: unknown;

  protected constructor(initValue: T, type: string) {
    this._wvid = allocateWorkletValueId();
    this._initValue = initValue;
    this._type = type;

    if (__JS__) {
      addMainThreadRefInitValue(this._wvid, initValue, type);

      const id = this._wvid;
      this._lifecycleObserver = lynx.getNativeApp().createJSObjectDestructionObserver?.(() => {
        lynx.getCoreContext?.().dispatchEvent({
          type: WorkletEvents.releaseWorkletRef,
          data: { id },
        });
      });
    }
  }

  /**
   * Register the factory that creates this value's real main-thread object.
   * The type must be globally unique, for example `@scope/package/value`.
   * Call this from code that executes during the main-thread render.
   *
   * @param type - Stable identifier serialized with the handle.
   * @param factory - Creates the main-thread object from the initial value.
   * @public
   */
  static register<T>(type: string, factory: (initValue: T) => object): void {
    if (__JS__) {
      return;
    }

    const schema = (globalThis as { globDynamicComponentEntry?: string })
      .globDynamicComponentEntry;
    loadWorkletRuntime(schema);
    registerMainThreadValueType(type, factory as (initValue: unknown) => object);
  }

  /** @internal */
  toJSON(): Pick<WorkletRefImpl<T>, '_wvid' | '_initValue' | '_type'> {
    return {
      _wvid: this._wvid,
      _initValue: this._initValue,
      _type: this._type,
    };
  }
}
