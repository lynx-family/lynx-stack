// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  scopeOnConfigChanged,
  scopeOnGlobalPropsChanged,
  scopeOnReload,
  scopeOnUpdateData,
} from './bts/data.js';
import { scopeOnGlobalEvent, scopeSetEventHandler } from './bts/events.js';
import {
  resolveCurrentHostScope,
  scopeOnDestroy,
  subscribeBTSSlot,
} from './bts/scope.js';
import {
  scopeCreatePipeline,
  scopeGetSystemInfo,
  scopeMarkTiming,
  scopeOnMessage,
  scopeSendMessage,
} from './bts/services.js';
import { copyHostData } from './common/protocol.js';
import type {
  BTSEventHandler,
  BTSPageRuntime,
  BTSReloadOptions,
  BTSUpdateOptions,
  CreatePipelineOptions,
  CreatedPipelineOptions,
  LynxSystemInfo,
  PipelineOptions,
  Unsubscribe,
} from './common/types.js';

export type {
  BTSEventHandler,
  BTSPageRuntime,
  BTSReloadOptions,
  BTSUpdateOptions,
  CreatedPipelineOptions,
  CreatePipelineOptions,
  LynxSystemInfo,
  PipelineOptions,
  Unsubscribe,
};

/**
 * Bind the BTS runtime to the page currently bootstrapping in the host environment
 * and return a page-scoped runtime handle isolated from subsequent `LynxGroup` page loads.
 * Call `bindPage()` synchronously during page bootstrap and retain the returned
 * `BTSPageRuntime` handle for all subsequent asynchronous work on that page.
 * Repeated binding to the same App returns the same handle, including its destruction
 * state. Binding captures the initial baseline and `GlobalProps`, and tracks
 * reload, `GlobalProps` updates, and destruction; other channels attach lazily on use.
 * Binding alone does not claim the raw event handler.
 * Throws when the host provides no BTS App; it does not create a page.
 */
export function bindPage(): BTSPageRuntime {
  const scope = resolveCurrentHostScope();
  scope.runtime ??= {
    isDestroyed: () => scope.destroyed,
    getSystemInfo: () => scopeGetSystemInfo(scope),
    createPipeline: (options) => scopeCreatePipeline(scope, options),
    markTiming: (pipeline, timingKey) =>
      scopeMarkTiming(scope, pipeline, timingKey),
    getId: () => scope.appId,
    getInitData: <T = Record<string, unknown>>() =>
      copyHostData(scope.initData) as T,
    getGlobalProps: <T = Record<string, unknown>>() =>
      scope.globalProps as Readonly<T>,
    onGlobalPropsChanged: <T = Record<string, unknown>>(
      listener: (globalProps: Readonly<T>) => void,
    ) => scopeOnGlobalPropsChanged<T>(scope, listener),
    onUpdateData: <T = Record<string, unknown>>(
      listener: (
        data: Readonly<T>,
        options: Readonly<BTSUpdateOptions>,
      ) => void,
    ) => scopeOnUpdateData<T>(scope, listener),
    onReload: <T = Record<string, unknown>>(
      listener: (
        data: Readonly<T>,
        options: Readonly<BTSReloadOptions>,
      ) => void,
    ) => scopeOnReload<T>(scope, listener),
    onConfigChanged: <T = Record<string, unknown>>(
      listener: (config: Readonly<T>) => void,
    ) => scopeOnConfigChanged<T>(scope, listener),
    onEnterForeground: (listener: () => void) =>
      subscribeBTSSlot(scope, 'onAppEnterForeground', listener),
    onEnterBackground: (listener: () => void) =>
      subscribeBTSSlot(scope, 'onAppEnterBackground', listener),
    onGlobalEvent: <Args extends unknown[] = unknown[]>(
      name: string,
      listener: (this: void, ...args: Args) => void,
    ) => scopeOnGlobalEvent(scope, name, listener),
    setEventHandler: <T = unknown>(handler: BTSEventHandler<T>) =>
      scopeSetEventHandler(scope, handler),
    sendMessage: (type: string, data?: unknown) =>
      scopeSendMessage(scope, type, data),
    onMessage: <T = unknown>(
      type: string,
      listener: (this: void, data: T) => void,
    ) => scopeOnMessage(scope, type, listener),
    onDestroy: (listener: () => void) => scopeOnDestroy(scope, listener),
  };
  return scope.runtime;
}
