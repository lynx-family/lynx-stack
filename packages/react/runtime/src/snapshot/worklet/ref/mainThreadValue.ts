// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { MainThreadObjectHandle, registerMainThreadObjectDefinition } from './mainThreadObject.js';

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
 * @deprecated Use `defineMainThreadObjectType` and `useMainThreadObject`.
 * @public
 */
export abstract class MainThreadValue<T> extends MainThreadObjectHandle<object> {
  protected constructor(initValue: T, type: string) {
    super(initValue, type);
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
    registerMainThreadObjectDefinition({
      type,
      create: factory,
    });
  }
}
