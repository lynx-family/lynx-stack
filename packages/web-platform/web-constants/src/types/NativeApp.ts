// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the

import type { CloneableObject } from './Cloneable.js';
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

export type NativeTTObject = {
  lynx: unknown;
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

export enum DispatchEventResult {
  // Event was not canceled by event handler or default event handler.
  NotCanceled = 0,
  // Event was canceled by event handler; i.e. a script handler calling
  // preventDefault.
  CanceledByEventHandler,
  // Event was canceled by the default event handler; i.e. executing the default
  // action.  This result should be used sparingly as it deviates from the DOM
  // Event Dispatch model. Default event handlers really shouldn't be invoked
  // inside of dispatch.
  CanceledByDefaultEventHandler,
  // Event was canceled but suppressed before dispatched to event handler.  This
  // result should be used sparingly; and its usage likely indicates there is
  // potential for a bug. Trusted events may return this code; but untrusted
  // events likely should always execute the event handler the developer intends
  // to execute.
  CanceledBeforeDispatch,
}
export interface ContextProxy {
  onTriggerEvent?: (event: MessageEvent) => void;

  postMessage(message: any): void;
  dispatchEvent(event: MessageEvent): DispatchEventResult;
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
  removeEventListener(
    type: string,
    listener: (event: MessageEvent) => void,
  ): void;
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
}
