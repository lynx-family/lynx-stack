// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { registerMainThreadValueClass } from './workletRef.js';

/**
 * Base class for main thread values on the worklet side.
 * Can be extended to create custom main thread value types.
 */
export class MainThreadValue<T> {
  _wvid: number;
  _initValue: T;
  _type: string;

  constructor(initValue: T, type: string) {
    this._initValue = initValue;
    this._type = type;
    // _wvid will be assigned by hydration logic
    this._wvid = 0;
  }

  /**
   * Get the current value. Only callable on the main thread.
   * Subclasses should use this in their value getter.
   */
  protected getValueOnMainThread(): T {
    return this._initValue;
  }

  /**
   * Set the current value. Only callable on the main thread.
   * Subclasses should use this in their value setter.
   */
  protected setValueOnMainThread(val: T): void {
    this._initValue = val;
  }

  /**
   * Register a custom MainThreadValue class.
   */
  static register(Ctor: new(initValue: unknown, type: string) => unknown, type: string): void {
    registerMainThreadValueClass(Ctor, type);
  }
}

/**
 * Main Thread counterpart of MainThreadRef.
 * Handles .current access.
 */
export class MainThreadRef<T> extends MainThreadValue<T> {
  // Matches the type string in runtime/src/worklet/ref/workletRef.ts
  static readonly TYPE = 'main-thread';

  constructor(initValue: T, type: string = MainThreadRef.TYPE) {
    super(initValue, type);
  }

  get current(): T {
    return this._initValue;
  }

  set current(val: T) {
    this._initValue = val;
  }
}

// Register it
MainThreadValue.register(MainThreadRef, MainThreadRef.TYPE);
