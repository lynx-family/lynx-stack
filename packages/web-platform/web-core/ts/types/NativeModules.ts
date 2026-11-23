// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type NativeModulesMap = Record<string, string>;

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
