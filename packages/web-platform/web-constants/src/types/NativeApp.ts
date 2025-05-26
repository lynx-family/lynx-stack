// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the

import type { CloneableObject } from './Cloneable.js';
import type { LynxContextEventTarget } from './LynxContextEventTarget.js';
import type { PerformancePipelineOptions } from './Performance.js';

// LICENSE file in the root directory of this source tree.
export const enum IdentifierType {
  ID_SELECTOR, // css selector
  /**
   * @deprecated
   */
  REF_ID,
  UNIQUE_ID, // element_id
}
export type LynxKernelInject = {
  init: (opt: { tt: LynxKernelInject }) => void;
  buildVersion?: string;
};

export interface EventEmitter {
  addListener(
    eventName: string,
    listener: (...args: unknown[]) => void,
    context?: object,
  ): void;

  removeListener(
    eventName: string,
    listener: (...args: unknown[]) => void,
  ): void;

  emit(eventName: string, data: unknown): void;

  removeAllListeners(eventName?: string): void;

  trigger(eventName: string, params: string | Record<any, any>): void;

  toggle(eventName: string, ...data: unknown[]): void;
}

export type NativeLynx = {
  __globalProps: CloneableObject;
  getJSModule(_moduleName: string): unknown;
  getNativeApp(): NativeApp;
  getCoreContext(): LynxContextEventTarget;
  getCustomSectionSync(key: string): CloneableObject;
  getCustomSection(key: string): Promise<CloneableObject>;
};

export type NativeTTObject = {
  lynx: NativeLynx;
  OnLifecycleEvent: (...args: unknown[]) => void;
  publicComponentEvent(
    componentId: string,
    handlerName: string,
    eventData?: unknown,
  ): void;
  publishEvent(handlerName: string, data?: unknown): void;
  GlobalEventEmitter: EventEmitter;
  lynxCoreInject: any;
  updateCardData: (
    newData: Record<string, any>,
    options?: Record<string, any>,
  ) => void;
  onNativeAppReady: () => void;
  globalThis?: {
    tt: NativeTTObject;
  };
  updateGlobalProps: (newData: Record<string, any>) => void;
};

export type BundleInitReturnObj = {
  /**
   * On the web platform
   * @param opt
   * @returns
   */
  init: (opt: {
    tt: NativeTTObject;
  }) => unknown;
  buildVersion?: string;
};

/**
 * const enum will be shakedown in Typescript Compiler
 */
export const enum ErrorCode {
  SUCCESS = 0,
  UNKNOWN = 1,
  NODE_NOT_FOUND = 2,
  METHOD_NOT_FOUND = 3,
  PARAM_INVALID = 4,
  SELECTOR_NOT_SUPPORTED = 5,
  NO_UI_FOR_NODE = 6,
}

export interface InvokeCallbackRes {
  code: ErrorCode;
  data?: string;
}

export interface NativeApp {
  id: string;

  callLepusMethod(
    name: string,
    data: unknown,
    callback: (ret: unknown) => void,
  ): void;

  setTimeout: typeof setTimeout;

  setInterval: typeof setInterval;

  clearTimeout: typeof clearTimeout;

  clearInterval: typeof clearInterval;

  requestAnimationFrame: (cb: () => void) => void;

  cancelAnimationFrame: (id: number) => void;

  loadScript: (sourceURL: string) => BundleInitReturnObj;

  loadScriptAsync(
    sourceURL: string,
    callback: (message: string | null, exports?: BundleInitReturnObj) => void,
  ): void;
  nativeModuleProxy: Record<string, any>;

  setNativeProps: (
    type: IdentifierType,
    identifier: string,
    component_id: string,
    first_only: boolean,
    native_props: Record<string, unknown>,
    root_unique_id: number | undefined,
  ) => void;

  invokeUIMethod: (
    type: IdentifierType,
    identifier: string,
    component_id: string,
    method: string,
    params: object,
    callback: (ret: InvokeCallbackRes) => void,
    root_unique_id: number,
  ) => void;

  setCard(tt: NativeTTObject): void;

  // Timing related
  generatePipelineOptions: () => PerformancePipelineOptions;
  onPipelineStart: (pipeline_id: string) => void;
  markPipelineTiming: (pipeline_id: string, timing_key: string) => void;
  bindPipelineIdWithTimingFlag: (
    pipeline_id: string,
    timing_flag: string,
  ) => void;

  /**
   * Support from Lynx 3.0
   */
  profileStart: (traceName: string, option?: unknown) => void;

  /**
   * Support from Lynx 3.0
   */
  profileEnd: () => void;

  triggerComponentEvent(id: string, params: {
    eventDetail: CloneableObject;
    eventOption: CloneableObject;
    componentId: string;
  }): void;

  selectComponent(
    componentId: string,
    idSelector: string,
    single: boolean,
    callback?: () => void,
  ): void;

  createJSObjectDestructionObserver(
    callback: (...args: unknown[]) => unknown,
  ): {};

  setSharedData<T>(dataKey: string, dataVal: T): void;
  getSharedData<T = unknown>(dataKey: string): T | undefined;
}
