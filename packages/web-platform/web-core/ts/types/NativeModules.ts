// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type NativeModulesMap = Record<string, string>;

/** Structured-cloneable value supported in `nativeModulesInitData`. */
export type NativeModuleInitData =
  | string
  | number
  | boolean
  | null
  | undefined
  | NativeModuleInitData[]
  | { [key: string]: NativeModuleInitData };

/** Per-module structured-cloneable initial data forwarded to background native module factories. */
export type NativeModulesInitData = Record<string, NativeModuleInitData>;

/** Handler registered by a background native module to receive host-dispatched events. */
export type NativeModuleEventHandler = (data: unknown) => void;

/** Context passed as the 3rd argument to a background native module factory. */
export interface NativeModuleContext {
  initData?: NativeModuleInitData;
  /** Set or clear the handler for events dispatched via `lynxView.sendNativeModuleEvent(moduleName, data)`. */
  setEventHandler: (handler: NativeModuleEventHandler | undefined) => void;
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
