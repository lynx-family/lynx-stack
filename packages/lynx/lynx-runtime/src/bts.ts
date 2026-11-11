// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { clearMessages, subscribeMessage } from './common/messages.js';
import type { MessageSubscriptions } from './common/messages.js';
import { createHostPipeline, markHostTiming } from './common/performance.js';
import {
  copyHostData,
  isPlainRecord,
  subscribeSlot,
} from './common/protocol.js';
import type {
  BTSEventHandler,
  BTSPageRuntime,
  BTSReloadOptions,
  BTSUpdateOptions,
  CreatePipelineOptions,
  CreatedPipelineOptions,
  HostBTSApp,
  HostContextProxy,
  HostGlobalEventEmitter,
  HostGlobalScope,
  HostLynxObject,
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

declare const lynx: HostLynxObject | undefined;

interface BTSPageScope {
  appId: string;
  app: HostBTSApp;
  lynx: HostLynxObject | undefined;
  rawInitData: Record<string, unknown> | undefined;
  initData: Record<string, unknown>;
  globalProps: Record<string, unknown>;
  unsubGlobalPropsSync?: Unsubscribe | undefined;
  destroying: boolean;
  destroyed: boolean;
  runtime?: BTSPageRuntime | undefined;
  eventEntry?: BTSEventEntry | undefined;
  globalEvents?: GlobalEventSubscriptions | undefined;
  messages?: MessageSubscriptions | undefined;
  notifications: Map<string, Map<object, Unsubscribe>>;
}

interface GlobalEventRegistration {
  callback: ((...args: unknown[]) => void) | undefined;
  dispose: Unsubscribe;
}

interface GlobalEventSubscription {
  emitter: HostGlobalEventEmitter;
  listeners: Set<GlobalEventRegistration>;
  dispatch: (...args: unknown[]) => void;
}

type GlobalEventSubscriptions = Map<string, GlobalEventSubscription>;

interface BTSEventEntry {
  current: { handler: BTSEventHandler } | undefined;
  publishEvent: NonNullable<HostBTSApp['publishEvent']>;
  publicComponentEvent: NonNullable<HostBTSApp['publicComponentEvent']>;
}

function createEventEntry(): BTSEventEntry {
  const dispatch: BTSEventHandler = (handlerName, data, componentId) => {
    const handler = entry.current?.handler;
    return handler?.(handlerName, data, componentId);
  };
  const entry: BTSEventEntry = {
    current: undefined,
    publishEvent: (handlerName, data) => dispatch(handlerName, data),
    publicComponentEvent: (componentId, handlerName, data) =>
      dispatch(handlerName, data, componentId),
  };
  return entry;
}

function assertScopeAlive(scope: BTSPageScope): void {
  if (scope.destroying || scope.destroyed) {
    throw new Error(
      '[@lynx-js/lynx-runtime/bts] Cannot register or activate a capability on a destroying or destroyed page. Check page.isDestroyed() before registering in async callbacks.',
    );
  }
}

function scopeSetEventHandler<T>(
  scope: BTSPageScope,
  handler: BTSEventHandler<T>,
): Unsubscribe {
  assertScopeAlive(scope);
  let entry = scope.eventEntry;
  if (!entry) {
    entry = scope.eventEntry = createEventEntry();
    // Both host slots share one owner; never chain an unmigrated DSL handler.
    scope.app.publishEvent = entry.publishEvent;
    scope.app.publicComponentEvent = entry.publicComponentEvent;
  }
  const registration = { handler: handler as BTSEventHandler };
  entry.current = registration;
  const currentEntry = entry;
  return () => {
    if (currentEntry.current === registration) {
      currentEntry.current = undefined;
    }
  };
}

const BTS_STORE_SYMBOL = Symbol.for('@lynx-js/lynx-runtime/bts');
const noop = (): void => {
  // Keep the slot dispatcher active for the lifetime of the page scope so `beforeDispatch` always runs.
};

function getScopeMap(host: HostGlobalScope): WeakMap<HostBTSApp, BTSPageScope> {
  const scope = host as unknown as Record<
    symbol,
    WeakMap<HostBTSApp, BTSPageScope> | undefined
  >;
  let map = scope[BTS_STORE_SYMBOL];
  if (!map) {
    map = new WeakMap();
    Object.defineProperty(host, BTS_STORE_SYMBOL, {
      value: map,
      configurable: true,
    });
  }
  return map;
}

function getScopeLynx(scope: BTSPageScope): HostLynxObject | undefined {
  if (scope.app.lynx) {
    return scope.app.lynx;
  }
  if (scope.lynx) {
    return scope.lynx;
  }
  const host = globalThis as unknown as HostGlobalScope;
  if (
    host.lynx
    && (host.lynx.getApp?.() === scope.app
      || (!host.lynx.getApp && !host.multiApps && host.tt === scope.app))
  ) {
    return host.lynx;
  }
  return undefined;
}

function scopeGetSystemInfo(scope: BTSPageScope): Readonly<LynxSystemInfo> {
  const host = globalThis as unknown as HostGlobalScope;
  const info = getScopeLynx(scope)?.SystemInfo;
  if (isPlainRecord(info)) return info;
  if (isPlainRecord(host.SystemInfo)) return host.SystemInfo;
  if (isPlainRecord(host.lynx?.SystemInfo)) return host.lynx.SystemInfo;
  return {};
}

function scopeCreatePipeline(
  scope: BTSPageScope,
  options?: CreatePipelineOptions,
): CreatedPipelineOptions | undefined {
  if (scope.destroying || scope.destroyed) return undefined;
  return createHostPipeline(
    getScopeLynx(scope)?.performance,
    options,
    'bts',
    scopeGetSystemInfo(scope).lynxSdkVersion,
  );
}

function scopeMarkTiming(
  scope: BTSPageScope,
  pipeline: string | PipelineOptions | undefined,
  timingKey: string,
): void {
  if (scope.destroying || scope.destroyed) return;
  markHostTiming(getScopeLynx(scope)?.performance, pipeline, timingKey);
}

function getCoreContext(scope: BTSPageScope): HostContextProxy {
  const proxy = getScopeLynx(scope)?.getCoreContext?.();
  if (!proxy) {
    throw new Error(
      '[@lynx-js/lynx-runtime/bts] Message communication requires lynx.getCoreContext(). Ensure the BTS host context is initialized before calling sendMessage() or onMessage().',
    );
  }
  return proxy;
}

function scopeSendMessage<T>(
  scope: BTSPageScope,
  type: string,
  data?: T,
): void {
  assertScopeAlive(scope);
  getCoreContext(scope).dispatchEvent({ type, data });
}

function scopeOnMessage<T>(
  scope: BTSPageScope,
  type: string,
  listener: (this: void, data: T) => void,
): Unsubscribe {
  assertScopeAlive(scope);
  const proxy = getCoreContext(scope);
  scope.messages ??= new Map();
  return subscribeMessage(scope.messages, proxy, type, listener);
}

function isGlobalEventEmitter(
  candidate: unknown,
): candidate is HostGlobalEventEmitter {
  return (
    typeof candidate === 'object'
    && candidate !== null
    && typeof (candidate as HostGlobalEventEmitter).addListener === 'function'
    && typeof (candidate as HostGlobalEventEmitter).removeListener
      === 'function'
  );
}

function getGlobalEventEmitter(scope: BTSPageScope): HostGlobalEventEmitter {
  const fromAppModule = scope.app.getJSModule?.('GlobalEventEmitter');
  if (isGlobalEventEmitter(fromAppModule)) {
    return fromAppModule;
  }
  if (isGlobalEventEmitter(scope.app.GlobalEventEmitter)) {
    return scope.app.GlobalEventEmitter;
  }
  const scopeLynx = getScopeLynx(scope);
  if (scopeLynx && (!scopeLynx.getApp || scopeLynx.getApp() === scope.app)) {
    const fromLynxModule = scopeLynx.getJSModule?.('GlobalEventEmitter');
    if (isGlobalEventEmitter(fromLynxModule)) {
      return fromLynxModule;
    }
  }
  throw new Error(
    '[@lynx-js/lynx-runtime/bts] Global event subscription requires GlobalEventEmitter. Ensure the BTS host environment is initialized before calling onGlobalEvent().',
  );
}

function releaseGlobalEventEntry(
  name: string,
  entry: GlobalEventSubscription,
): void {
  for (const registration of entry.listeners) {
    registration.callback = undefined;
  }
  entry.listeners.clear();
  entry.emitter.removeListener(name, entry.dispatch);
}

function clearGlobalEvents(subscriptions: GlobalEventSubscriptions): void {
  for (const [name, entry] of subscriptions) {
    releaseGlobalEventEntry(name, entry);
  }
  subscriptions.clear();
}

/**
 * Share one host listener per event name on the bound page's GlobalEventEmitter so
 * disposing one subscriber does not disable shared host detectors (such as
 * `keyboardstatuschanged`) or mutate lynx-core's array during `forEach` dispatch.
 */
function scopeOnGlobalEvent<Args extends unknown[]>(
  scope: BTSPageScope,
  name: string,
  listener: (this: void, ...args: Args) => void,
): Unsubscribe {
  assertScopeAlive(scope);
  const emitter = getGlobalEventEmitter(scope);
  scope.globalEvents ??= new Map<string, GlobalEventSubscription>();
  const subscriptions = scope.globalEvents;
  let entry = subscriptions.get(name);
  if (entry && entry.emitter !== emitter) {
    releaseGlobalEventEntry(name, entry);
    subscriptions.delete(name);
    entry = undefined;
  }
  if (!entry) {
    const listeners = new Set<GlobalEventRegistration>();
    const dispatch = (...args: unknown[]): void => {
      let failed = false;
      let firstError: unknown;
      for (const registration of [...listeners]) {
        if (!listeners.has(registration)) continue;
        const callback = registration.callback!;
        try {
          callback(...args);
        } catch (error) {
          if (!failed) {
            failed = true;
            firstError = error;
          }
        }
      }
      if (failed) throw firstError;
    };
    entry = { emitter, listeners, dispatch };
    emitter.addListener(name, dispatch);
    subscriptions.set(name, entry);
  }
  const current = entry;
  const callback = listener as (...args: unknown[]) => void;
  for (const registration of current.listeners) {
    if (registration.callback === callback) return registration.dispose;
  }
  const registration: GlobalEventRegistration = {
    callback,
    dispose: () => {
      if (!current.listeners.delete(registration)) return;
      registration.callback = undefined;
      if (current.listeners.size > 0 || subscriptions.get(name) !== current) {
        return;
      }
      current.emitter.removeListener(name, current.dispatch);
      subscriptions.delete(name);
    },
  };
  current.listeners.add(registration);
  return registration.dispose;
}

function syncScopeGlobalProps(
  scope: BTSPageScope,
  newData: Record<string, unknown> | undefined,
): void {
  scope.globalProps = isPlainRecord(newData) ? copyHostData(newData) : {};
}

function mergeBTSInitData(
  rawInitData: Record<string, unknown> | undefined,
  dynamicData: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const base = rawInitData ? copyHostData(rawInitData) : undefined;
  const next = isPlainRecord(dynamicData)
    ? copyHostData(dynamicData)
    : undefined;
  return { ...base, ...next };
}

function syncScopeReloadData(
  scope: BTSPageScope,
  newData: Record<string, unknown> | undefined,
): void {
  scope.initData = mergeBTSInitData(scope.rawInitData, newData);
}

function scopeOnDestroy(
  scope: BTSPageScope,
  listener: () => void,
): Unsubscribe {
  return subscribeNotification(
    scope,
    'callDestroyLifetimeFun',
    listener,
    (dispose) => {
      let active = true;
      const unsub = subscribeSlot(scope.app, 'callDestroyLifetimeFun', () => {
        if (!active) return;
        dispose();
        listener();
      });
      return () => {
        active = false;
        unsub();
      };
    },
  );
}

/** Deduplicate DSL callbacks before host argument adapters change their identity. */
function subscribeNotification(
  scope: BTSPageScope,
  key: string,
  listener: object,
  subscribe: (dispose: Unsubscribe) => Unsubscribe,
): Unsubscribe {
  assertScopeAlive(scope);
  let listeners = scope.notifications.get(key);
  if (!listeners) {
    listeners = new Map();
    scope.notifications.set(key, listeners);
  }
  const existing = listeners.get(listener);
  if (existing) return existing;

  const currentListeners = listeners;
  const dispose = (): void => {
    if (currentListeners.get(listener) !== dispose) return;
    currentListeners.delete(listener);
    if (currentListeners.size === 0) scope.notifications.delete(key);
    unsubscribe();
  };
  const unsubscribe = subscribe(dispose);
  currentListeners.set(listener, dispose);
  return dispose;
}

function hookScope<Args extends unknown[]>(
  scope: BTSPageScope,
  key: string,
  listener: (...args: Args) => void,
  identity: object = listener,
): Unsubscribe {
  return subscribeNotification(scope, key, identity, (dispose) => {
    const unsub = subscribeSlot<Args>(scope.app, key, listener);
    // User onDestroy(dispose) must not share ownership of automatic cleanup.
    const unsubDestroy = scopeOnDestroy(scope, () => dispose());
    return () => {
      unsubDestroy();
      unsub();
    };
  });
}

function scopeGetId(scope: BTSPageScope): string {
  return scope.appId;
}

function scopeGetInitData<T = Record<string, unknown>>(scope: BTSPageScope): T {
  return copyHostData(scope.initData) as T;
}

function scopeGetGlobalProps<T = Record<string, unknown>>(
  scope: BTSPageScope,
): Readonly<T> {
  activateGlobalProps(scope);
  return scope.globalProps as Readonly<T>;
}

function activateGlobalProps(scope: BTSPageScope): void {
  if (scope.unsubGlobalPropsSync || scope.destroying || scope.destroyed) {
    return;
  }
  // Unmigrated DSL handlers may have updated or replaced this value since binding.
  const liveProps = getScopeLynx(scope)?.__globalProps;
  scope.globalProps = isPlainRecord(liveProps) ? copyHostData(liveProps) : {};
  scope.unsubGlobalPropsSync = subscribeSlot<
    [Record<string, unknown> | undefined]
  >(scope.app, 'updateGlobalProps', noop, (newData) => {
    syncScopeGlobalProps(scope, newData);
  });
}

function scopeOnGlobalPropsChanged<T = Record<string, unknown>>(
  scope: BTSPageScope,
  listener: (globalProps: Readonly<T>) => void,
): Unsubscribe {
  assertScopeAlive(scope);
  activateGlobalProps(scope);
  return hookScope<[Record<string, unknown> | undefined]>(
    scope,
    'updateGlobalProps',
    () => {
      listener(scope.globalProps as Readonly<T>);
    },
    listener,
  );
}

function scopeOnUpdateData<T = Record<string, unknown>>(
  scope: BTSPageScope,
  listener: (data: Readonly<T>, options: Readonly<BTSUpdateOptions>) => void,
): Unsubscribe {
  assertScopeAlive(scope);
  return hookScope<
    [
      Record<string, unknown> | undefined,
      | { type?: number | undefined; processorName?: string | undefined }
      | undefined,
    ]
  >(
    scope,
    'updateCardData',
    (data, rawOptions) => {
      listener((data ?? {}) as Readonly<T>, {
        resetPageData: rawOptions?.type === 1,
        processorName: rawOptions?.processorName,
      });
    },
    listener,
  );
}

function scopeOnReload<T = Record<string, unknown>>(
  scope: BTSPageScope,
  listener: (data: Readonly<T>, options: Readonly<BTSReloadOptions>) => void,
): Unsubscribe {
  return hookScope<
    [Record<string, unknown> | undefined, BTSReloadOptions | undefined]
  >(
    scope,
    'onAppReload',
    (data, options) => {
      listener((data ?? {}) as Readonly<T>, options ?? {});
    },
    listener,
  );
}

function scopeOnConfigChanged<T = Record<string, unknown>>(
  scope: BTSPageScope,
  listener: (config: Readonly<T>) => void,
): Unsubscribe {
  return hookScope<[Record<string, unknown> | undefined]>(
    scope,
    'processCardConfig',
    (config) => {
      listener((config ?? {}) as Readonly<T>);
    },
    listener,
  );
}

function createBTSPageScope(
  targetApp: HostBTSApp,
  host: HostGlobalScope,
  lexicalLynx: HostLynxObject | undefined,
): BTSPageScope {
  const scopeMap = getScopeMap(host);
  const existing = scopeMap.get(targetApp);
  if (existing) {
    return existing;
  }

  let boundLynx = targetApp.lynx;
  if (
    !boundLynx
    && lexicalLynx
    && (!lexicalLynx.getApp || lexicalLynx.getApp() === targetApp)
  ) {
    boundLynx = lexicalLynx;
  } else if (
    !boundLynx
    && host.lynx
    && (host.lynx.getApp?.() === targetApp
      || (!host.lynx.getApp && !host.multiApps && host.tt === targetApp))
  ) {
    boundLynx = host.lynx;
  }

  const params = targetApp._params;
  const rawInitData = isPlainRecord(params?.initData)
    ? copyHostData(params.initData)
    : undefined;
  const initData = mergeBTSInitData(rawInitData, params?.updateData);

  const scope: BTSPageScope = {
    appId: params?.appGUID ?? targetApp.nativeAppId ?? '',
    app: targetApp,
    lynx: boundLynx,
    rawInitData,
    initData,
    globalProps: isPlainRecord(boundLynx?.__globalProps)
      ? copyHostData(boundLynx.__globalProps)
      : {},
    destroying: false,
    destroyed: false,
    notifications: new Map(),
  };

  const unsubReloadSync = subscribeSlot<
    [Record<string, unknown> | undefined, BTSReloadOptions | undefined]
  >(targetApp, 'onAppReload', noop, (newData) => {
    syncScopeReloadData(scope, newData);
  });

  const unsubDestroySync = subscribeSlot(
    targetApp,
    'callDestroyLifetimeFun',
    noop,
    () => {
      const scopeLynx = getScopeLynx(scope);
      if (!scope.unsubGlobalPropsSync) {
        const liveProps = scopeLynx?.__globalProps;
        scope.globalProps = isPlainRecord(liveProps)
          ? copyHostData(liveProps)
          : {};
      }
      scope.destroying = true;
      if (scope.globalEvents) {
        clearGlobalEvents(scope.globalEvents);
        scope.globalEvents = undefined;
      }
      if (scope.messages) {
        clearMessages(scope.messages);
        scope.messages = undefined;
      }
      const entry = scope.eventEntry;
      if (entry) {
        entry.current = undefined;
        for (const key of ['publishEvent', 'publicComponentEvent'] as const) {
          if (scope.app[key] === entry[key]) {
            scope.app[key] = noop;
          }
        }
        scope.eventEntry = undefined;
      }
    },
    () => {
      // Keep the bound page readable throughout host and DSL destruction callbacks.
      scope.destroying = false;
      scope.destroyed = true;
      scope.unsubGlobalPropsSync?.();
      unsubReloadSync();
      unsubDestroySync();
    },
  );

  scopeMap.set(targetApp, scope);
  return scope;
}

function resolveOptionalHostApp(
  host: HostGlobalScope,
  lexicalLynx: HostLynxObject | undefined,
): HostBTSApp | undefined {
  const currentMultiApp = host.currentAppId && host.multiApps
    ? host.multiApps[host.currentAppId]
    : undefined;
  return (
    lexicalLynx?.getApp?.()
      ?? host.lynx?.getApp?.()
      ?? currentMultiApp
      ?? host.tt
  );
}

function resolveCurrentHostScope(): BTSPageScope {
  const host = globalThis as unknown as HostGlobalScope;
  const lexicalLynx = typeof lynx === 'undefined' ? undefined : lynx;
  const resolved = resolveOptionalHostApp(host, lexicalLynx);
  if (!resolved) {
    throw new Error(
      '[@lynx-js/lynx-runtime/bts] Unable to resolve BTS App instance (`tt`). Call bindPage() synchronously during BTS page bootstrap and retain the returned handle.',
    );
  }
  return createBTSPageScope(resolved, host, lexicalLynx);
}

/**
 * Bind the BTS runtime to the page currently bootstrapping in the host environment
 * and return a page-scoped runtime handle isolated from subsequent `LynxGroup` page loads.
 * Call `bindPage()` synchronously during page bootstrap and retain the returned
 * `BTSPageRuntime` handle for all subsequent asynchronous work on that page.
 * Repeated binding to the same App returns the same handle, including its destruction
 * state. Binding captures the initial baseline and tracks reload/destruction; other
 * channels activate on use. Binding alone does not claim the raw event handler.
 * Throws when the host provides no BTS App; it does not create a page.
 */
export function bindPage(): BTSPageRuntime {
  const scope = resolveCurrentHostScope();
  scope.runtime ??= {
    isDestroyed: () => scope.destroying || scope.destroyed,
    getSystemInfo: () => scopeGetSystemInfo(scope),
    createPipeline: (options) => scopeCreatePipeline(scope, options),
    markTiming: (pipeline, timingKey) =>
      scopeMarkTiming(scope, pipeline, timingKey),
    getId: () => scopeGetId(scope),
    getInitData: <T = Record<string, unknown>>() => scopeGetInitData<T>(scope),
    getGlobalProps: <T = Record<string, unknown>>() =>
      scopeGetGlobalProps<T>(scope),
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
      hookScope(scope, 'onAppEnterForeground', listener),
    onEnterBackground: (listener: () => void) =>
      hookScope(scope, 'onAppEnterBackground', listener),
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
