// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  HostBTSApp,
  HostGlobalScope,
  HostLynxObject,
} from '../common/host-types.js';
import { clearMultiplexed } from '../common/messages.js';
import type { MessageSubscriptions, MultiplexMap } from '../common/messages.js';
import {
  copyHostData,
  invokeAll,
  subscribeListener,
} from '../common/protocol.js';
import type {
  BTSEventHandler,
  BTSPageRuntime,
  Unsubscribe,
} from '../common/types.js';

declare const lynx: HostLynxObject | undefined;

/** @internal */
export type AnySlotFn = (...args: unknown[]) => void;

/** @internal */
export type BTSSlotListeners = Map<
  object,
  { invoke: AnySlotFn; dispose: Unsubscribe }
>;

/** @internal */
export interface BTSEventEntry {
  current: { handler: BTSEventHandler } | undefined;
  publishEvent: NonNullable<HostBTSApp['publishEvent']>;
  publicComponentEvent: NonNullable<HostBTSApp['publicComponentEvent']>;
}

/** @internal */
export interface BTSPageScope {
  appId: string;
  app: HostBTSApp;
  lynx: HostLynxObject | undefined;
  rawInitData: Record<string, unknown> | undefined;
  initData: Record<string, unknown>;
  globalProps: Record<string, unknown>;
  destroyed: boolean;
  runtime?: BTSPageRuntime | undefined;
  eventEntry?: BTSEventEntry | undefined;
  globalEvents?: MultiplexMap<(...args: unknown[]) => void> | undefined;
  messages?: MessageSubscriptions | undefined;
  slots: Map<string, BTSSlotListeners>;
  destroyListeners: Map<() => void, Unsubscribe>;
}

const btsScopeMap = new WeakMap<HostBTSApp, BTSPageScope>();

/** @internal */
export function assertScopeAlive(scope: BTSPageScope): void {
  if (scope.destroyed) {
    throw new Error(
      '[@lynx-js/lynx-runtime/bts] Cannot register or activate a capability on a destroying or destroyed page. Check page.isDestroyed() before registering in async callbacks.',
    );
  }
}

/** @internal */
export function resolveHostLynx(
  app: HostBTSApp,
  host: HostGlobalScope,
): HostLynxObject | undefined {
  const hostLynx = host.lynx;
  if (
    hostLynx
    && (hostLynx.getApp?.() === app
      || (!hostLynx.getApp && !host.multiApps && host.tt === app))
  ) {
    return hostLynx;
  }
  return undefined;
}

/** @internal */
export function getScopeLynx(scope: BTSPageScope): HostLynxObject | undefined {
  return (
    scope.app.lynx
      ?? scope.lynx
      ?? resolveHostLynx(scope.app, globalThis as unknown as HostGlobalScope)
  );
}

function mergeBTSInitData(
  rawInitData: Record<string, unknown> | undefined,
  dynamicData: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return {
    ...rawInitData,
    ...(dynamicData ? copyHostData(dynamicData) : undefined),
  };
}

/** @internal */
export function ensureBTSSlot(
  scope: BTSPageScope,
  key: string,
  before?: AnySlotFn,
): BTSSlotListeners {
  let listeners = scope.slots.get(key);
  if (listeners) return listeners;

  const appRecord = scope.app as Record<string, AnySlotFn | undefined>;
  const prev = appRecord[key];
  listeners = new Map();
  const currentListeners = listeners;
  appRecord[key] = function(this: unknown, ...args: unknown[]): void {
    if (!scope.destroyed) {
      before?.(...args);
    }
    prev?.apply(this, args);
    if (scope.destroyed) return;
    for (const [identity, reg] of [...currentListeners]) {
      if (currentListeners.get(identity) === reg) {
        reg.invoke(...args);
      }
    }
  };
  scope.slots.set(key, listeners);
  return listeners;
}

/** @internal */
export function subscribeBTSSlot<Args extends unknown[]>(
  scope: BTSPageScope,
  key: string,
  invoke: (...args: Args) => void,
  identity: object = invoke,
): Unsubscribe {
  assertScopeAlive(scope);
  const listeners = ensureBTSSlot(scope, key);
  const existing = listeners.get(identity);
  if (existing) return existing.dispose;

  const dispose = (): void => {
    if (listeners.get(identity)?.dispose === dispose) {
      listeners.delete(identity);
    }
  };
  listeners.set(identity, { invoke: invoke as AnySlotFn, dispose });
  return dispose;
}

/** @internal */
export function scopeOnDestroy(
  scope: BTSPageScope,
  listener: () => void,
): Unsubscribe {
  assertScopeAlive(scope);
  return subscribeListener(scope.destroyListeners, listener);
}

function createBTSPageScope(
  targetApp: HostBTSApp,
  host: HostGlobalScope,
  lexicalLynx: HostLynxObject | undefined,
): BTSPageScope {
  const existing = btsScopeMap.get(targetApp);
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
  }
  boundLynx ??= resolveHostLynx(targetApp, host);

  const params = targetApp._params;
  const rawInitData = params?.initData
    ? copyHostData(params.initData)
    : undefined;
  const initData = mergeBTSInitData(rawInitData, params?.updateData);

  const scope: BTSPageScope = {
    appId: params?.appGUID ?? targetApp.nativeAppId ?? '',
    app: targetApp,
    lynx: boundLynx,
    rawInitData,
    initData,
    globalProps: boundLynx?.__globalProps ?? {},
    destroyed: false,
    slots: new Map(),
    destroyListeners: new Map(),
  };

  ensureBTSSlot(scope, 'onAppReload', (newData) => {
    scope.initData = mergeBTSInitData(
      scope.rawInitData,
      newData as Record<string, unknown> | undefined,
    );
  });
  ensureBTSSlot(scope, 'updateGlobalProps', (newData) => {
    scope.globalProps = (newData as Record<string, unknown> | null | undefined)
      ?? {};
  });

  const prevDestroy = targetApp.callDestroyLifetimeFun;
  targetApp.callDestroyLifetimeFun = function(this: unknown): void {
    if (scope.destroyed) {
      prevDestroy?.call(this);
      return;
    }
    scope.destroyed = true;
    if (scope.globalEvents) {
      clearMultiplexed(scope.globalEvents);
      scope.globalEvents = undefined;
    }
    if (scope.messages) {
      clearMultiplexed(scope.messages);
      scope.messages = undefined;
    }
    if (scope.eventEntry) {
      scope.eventEntry.current = undefined;
      scope.eventEntry = undefined;
    }
    try {
      invokeAll([
        ...(prevDestroy ? [() => prevDestroy.call(this)] : []),
        ...[...scope.destroyListeners].map(([listener, reg]) => () => {
          if (scope.destroyListeners.get(listener) === reg) {
            listener();
          }
        }),
      ]);
    } finally {
      scope.destroyListeners.clear();
      for (const listeners of scope.slots.values()) {
        listeners.clear();
      }
      scope.slots.clear();
    }
  };

  btsScopeMap.set(targetApp, scope);
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

/** @internal */
export function resolveCurrentHostScope(): BTSPageScope {
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
