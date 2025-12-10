// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ErrorCode, IdentifierType } from '../constants.js';
import type { CloneableObject } from './Cloneable.js';
import type { LynxContextEventTarget } from './LynxContextEventTarget.js';
import type { PerformancePipelineOptions } from './TimingAPIs.js';
import type { II18nResource } from './I18nTypes.js';

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

export interface InvokeCallbackRes {
  code: ErrorCode;
  data?: unknown;
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

  readScript: (sourceURL: string, entryName?: string) => string;

  loadScript: (sourceURL: string, entryName?: string) => BundleInitReturnObj;

  loadScriptAsync(
    sourceURL: string,
    callback: (message: string | null, exports?: BundleInitReturnObj) => void,
    entryName?: string,
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

  getPathInfo: (
    type: IdentifierType,
    identifier: string,
    component_id: string,
    first_only: boolean,
    callback: (ret: InvokeCallbackRes) => void,
    root_unique_id?: number,
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

  /***
   * Support from Lynx 3.0
   */
  profileMark: () => void;

  /**
   * Support from Lynx 3.0
   */
  profileFlowId: () => number;

  /**
   * Support from Lynx 2.18
   */
  isProfileRecording: () => boolean;

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

  i18nResource: II18nResource;

  reportException: (error: Error, _: unknown) => void;
  __SetSourceMapRelease: (err: Error) => void;
  __GetSourceMapRelease: (url: string) => string | undefined;

  queryComponent: (
    source: string,
    callback: (
      ret: { __hasReady: boolean } | {
        code: number;
        detail?: { schema: string };
      },
    ) => void,
  ) => void;
  tt: NativeTTObject | null;
}
