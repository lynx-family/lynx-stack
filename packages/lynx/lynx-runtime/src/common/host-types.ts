// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  BTSReloadOptions,
  LynxSystemInfo,
  MTSFlushContext,
  MTSFlushOptions,
  MTSReloadOptions,
  MTSRenderOptions,
  PipelineOptions,
} from './types.js';

/**
 * Minimal structural interfaces for Lynx host globals so `@lynx-js/lynx-runtime`
 * does not rely on ambient TypeScript global declarations (`declare global`).
 * @internal
 */
export interface HostMessageEvent<T = unknown> {
  type: string;
  data: T;
  origin?: string | undefined;
  target?: string | undefined;
}

/**
 * @internal
 */
export interface HostContextProxy {
  dispatchEvent(event: { type: string; data: unknown }): void;
  addEventListener<T = unknown>(
    type: string,
    listener: (event: HostMessageEvent<T>) => void,
  ): void;
  removeEventListener<T = unknown>(
    type: string,
    listener: (event: HostMessageEvent<T>) => void,
  ): void;
}

/**
 * @internal
 */
export interface HostGlobalEventEmitter {
  addListener(
    eventName: string,
    listener: (...args: unknown[]) => void,
    context?: unknown,
  ): void;
  removeListener(
    eventName: string,
    listener: (...args: unknown[]) => void,
  ): void;
}

/**
 * @internal
 */
export interface HostBTSApp {
  publishEvent?:
    | ((handlerName: string, data: unknown, ...hostArgs: unknown[]) => unknown)
    | undefined;
  publicComponentEvent?:
    | ((
      componentId: string,
      handlerName: string,
      data: unknown,
      ...hostArgs: unknown[]
    ) => unknown)
    | undefined;
  nativeAppId?: string | undefined;
  _params?: {
    initData?: Record<string, unknown> | undefined;
    updateData?: Record<string, unknown> | undefined;
    cardType?: string | undefined;
    appGUID?: string | undefined;
    srcName?: string | undefined;
  } | undefined;
  lynx?: HostLynxObject | undefined;
  GlobalEventEmitter?: HostGlobalEventEmitter | null | undefined;
  getJSModule?: ((moduleName: string) => unknown) | undefined;
  updateCardData?:
    | ((
      data: Record<string, unknown>,
      options?: {
        type?: number | undefined;
        processorName?: string | undefined;
      },
    ) => void)
    | undefined;
  updateGlobalProps?: ((newData: Record<string, unknown>) => void) | undefined;
  onAppReload?:
    | ((data: Record<string, unknown>, options?: BTSReloadOptions) => void)
    | undefined;
  processCardConfig?: ((config: Record<string, unknown>) => void) | undefined;
  onAppEnterForeground?: (() => void) | undefined;
  onAppEnterBackground?: (() => void) | undefined;
  callDestroyLifetimeFun?: (() => void) | undefined;
}

/**
 * @internal
 */
export interface HostPerformanceObject {
  _generatePipelineOptions?:
    | (() => PipelineOptions | null | undefined)
    | undefined;
  _onPipelineStart?:
    | ((pipelineID: string, options?: string | PipelineOptions) => void)
    | undefined;
  _bindPipelineIDWithTimingFlag?:
    | ((pipelineID: string, timingFlag: string) => void)
    | undefined;
  _bindPipelineIdWithTimingFlag?:
    | ((pipelineID: string, timingFlag: string) => void)
    | undefined;
  _markTiming?: ((pipelineID: string, timingKey: string) => void) | undefined;
}

/** @internal */
export interface HostLynxObject {
  SystemInfo?: LynxSystemInfo | undefined;
  performance?: HostPerformanceObject | undefined;
  __globalProps?: Record<string, unknown> | undefined;
  __initData?: Record<string, unknown> | undefined;
  getEngine?: (() => HostContextProxy | undefined) | undefined;
  getNative?: (() => HostContextProxy | undefined) | undefined;
  getCoreContext?: (() => HostContextProxy | undefined) | undefined;
  getJSContext?: (() => HostContextProxy | undefined) | undefined;
  getApp?: (() => HostBTSApp | undefined) | undefined;
  getJSModule?: ((moduleName: string) => unknown) | undefined;
}

/**
 * @internal
 */
export interface HostGlobalScope {
  __FlushElementTree?:
    | ((page?: unknown, options?: Readonly<MTSFlushOptions>) => void)
    | undefined;
  SystemInfo?: LynxSystemInfo | undefined;
  lynx?: HostLynxObject | undefined;
  tt?: HostBTSApp | undefined;
  currentAppId?: string | undefined;
  multiApps?: Record<string, HostBTSApp | undefined> | undefined;
  renderPage?:
    | ((data: Record<string, unknown>, options?: MTSRenderOptions) => void)
    | undefined;
  updatePage?:
    | ((data: Record<string, unknown>, options?: MTSReloadOptions) => void)
    | undefined;
  updateGlobalProps?:
    | ((data: Record<string, unknown>, options?: MTSFlushContext) => void)
    | undefined;
  processData?:
    | ((data: unknown, processorName?: string) => unknown)
    | undefined;
  getPageData?: ((keys?: string[]) => unknown) | undefined;
  removeComponents?: (() => void) | undefined;
}
