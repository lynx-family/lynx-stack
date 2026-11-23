// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Cloneable } from './Cloneable.js';

export type NativeModulesMap = Record<string, string>;

/** Per-module structured-cloneable initial data forwarded to background native module factories. */
export type NativeModulesInitData = Record<string, Cloneable>;

/** Context passed as the 3rd argument to a background native module factory. */
export interface NativeModuleContext {
  initData?: Cloneable;
}

/** A host-provided module available synchronously through main-thread `lynx.module()`. */
export interface MainThreadModule {
  /** Invokes a method synchronously with the supplied arguments. */
  invoke(method: string, ...args: unknown[]): unknown;
}

export type NativeModulesCall = (
  name: string,
  data: any,
  moduleName: string,
) => Promise<any> | any;
