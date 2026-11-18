// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  HostContextProxy,
  HostGlobalScope,
  HostMessageEvent,
} from '../common/host-types.js';
import { clearMultiplexed } from '../common/messages.js';
import type { MessageSubscriptions } from '../common/messages.js';
import {
  NATIVE_EVENT_DESTROY_LIFETIME,
  NATIVE_EVENT_RENDER_PAGE,
  NATIVE_EVENT_UPDATE_GLOBAL_PROPS,
  NATIVE_EVENT_UPDATE_PAGE,
  copyHostData,
  dispatchListeners,
  invokeAll,
  subscribeListener,
} from '../common/protocol.js';
import type {
  MTSFlushContext,
  MTSReloadOptions,
  MTSRenderOptions,
  MTSUpdateOptions,
  Unsubscribe,
} from '../common/types.js';

/** @internal */
export type MTSSingleOwnerKey = 'processData' | 'getPageData';

/** @internal */
export interface MTSHostState {
  destroyed: boolean;
  hasDestroyProxy: boolean;
  destroyListeners: Map<() => void, Unsubscribe>;
  jsContext?: HostContextProxy | undefined;
  globalProps: Record<string, unknown>;
  initData: Record<string, unknown>;
  renderListeners: Map<
    (data: Record<string, unknown>, options: MTSRenderOptions) => void,
    Unsubscribe
  >;
  updateListeners: Map<
    (data: Record<string, unknown>, options: MTSUpdateOptions) => void,
    Unsubscribe
  >;
  reloadListeners: Map<
    (data: Record<string, unknown>, options: MTSReloadOptions) => void,
    Unsubscribe
  >;
  globalPropsListeners: Map<
    (
      globalProps: Record<string, unknown>,
      options?: MTSFlushContext,
    ) => void,
    Unsubscribe
  >;
  slots: {
    [K in MTSSingleOwnerKey]?: HostGlobalScope[K];
  };
  messages?: MessageSubscriptions | undefined;
}

const mtsStateMap = new WeakMap<object, MTSHostState>();

/** @internal */
export const defaultProcessData = <T>(data: T): T => data;
/** @internal */
export const defaultGetPageData = (): null => null;
const noop = (): void => {
  // Safe placeholder for C++ QuickContext::GetAndCall (try_call = false) entrypoints.
};

/** @internal */
export function isMTSHostDestroyed(host: HostGlobalScope): boolean {
  return mtsStateMap.get(host.lynx ?? host)?.destroyed === true;
}

/** @internal */
export function initMTSHostState(host: HostGlobalScope): MTSHostState {
  const key = host.lynx ?? host;
  const existing = mtsStateMap.get(key);
  if (existing) return existing;

  const nativeProxy = host.lynx?.getNative?.();
  const state: MTSHostState = {
    destroyed: false,
    hasDestroyProxy: nativeProxy !== undefined,
    destroyListeners: new Map(),
    globalProps: {},
    initData: {},
    renderListeners: new Map(),
    updateListeners: new Map(),
    reloadListeners: new Map(),
    globalPropsListeners: new Map(),
    slots: {},
  };
  mtsStateMap.set(key, state);

  const onRenderInput = (
    data?: Record<string, unknown> | null,
    options?: MTSRenderOptions,
  ): void => {
    if (state.destroyed) return;
    const normalizedData = data ?? {};
    state.initData = copyHostData(normalizedData);
    const normalizedOptions = options ?? {};
    dispatchListeners(state.renderListeners, (listener) => {
      listener(normalizedData, normalizedOptions);
    });
  };

  const onUpdateInput = (
    data?: Record<string, unknown> | null,
    options?: MTSReloadOptions,
  ): void => {
    if (state.destroyed) return;
    const normalizedData = data ?? {};
    const normalizedOptions = options ?? {};
    if (normalizedOptions.reloadTemplate) {
      state.initData = copyHostData(normalizedData);
      dispatchListeners(state.reloadListeners, (listener) => {
        listener(normalizedData, normalizedOptions);
      });
    } else {
      dispatchListeners(state.updateListeners, (listener) => {
        listener(normalizedData, normalizedOptions);
      });
    }
  };

  const onGlobalPropsInput = (
    data?: Record<string, unknown> | null,
    options?: MTSFlushContext,
  ): void => {
    if (state.destroyed) return;
    const normalizedData = data ?? {};
    dispatchListeners(state.globalPropsListeners, (listener) => {
      listener(normalizedData, options);
    });
  };

  // Install global entrypoints and placeholders upfront so C++ GetAndCall (try_call = false)
  // never fails when a capability (such as updateGlobalProps or processData) has no user listener.
  host.renderPage = onRenderInput;
  host.updatePage = onUpdateInput;
  host.updateGlobalProps = onGlobalPropsInput;
  host.processData ??= defaultProcessData;
  host.removeComponents ??= noop;
  host.getPageData ??= defaultGetPageData;
  if (host.lynx?.SystemInfo && !host.SystemInfo) {
    // Native UpdateScreenMetrics mutates global SystemInfo.pixelRatio in place.
    host.SystemInfo = host.lynx.SystemInfo;
  }

  const engine = host.lynx?.getEngine?.();
  if (engine) {
    engine.addEventListener(
      NATIVE_EVENT_RENDER_PAGE,
      (event: HostMessageEvent<unknown[]>) => {
        const [data, options] = event.data;
        onRenderInput(
          data as Record<string, unknown> | null | undefined,
          options as MTSRenderOptions | undefined,
        );
      },
    );
    engine.addEventListener(
      NATIVE_EVENT_UPDATE_PAGE,
      (event: HostMessageEvent<unknown[]>) => {
        const [data, options] = event.data;
        onUpdateInput(
          data as Record<string, unknown> | null | undefined,
          options as MTSReloadOptions | undefined,
        );
      },
    );
    engine.addEventListener(
      NATIVE_EVENT_UPDATE_GLOBAL_PROPS,
      (event: HostMessageEvent<unknown[]>) => {
        const [data, options] = event.data;
        onGlobalPropsInput(
          data as Record<string, unknown> | null | undefined,
          options as MTSFlushContext | undefined,
        );
      },
    );
  }

  if (nativeProxy) {
    const onNativeDestroy = (): void => {
      if (state.destroyed) return;
      state.globalProps = host.lynx?.__globalProps ?? state.globalProps;
      state.destroyed = true;
      try {
        if (state.messages) {
          clearMultiplexed(state.messages);
          state.messages = undefined;
        }
        invokeAll(
          [...state.destroyListeners].map(([listener, reg]) => () => {
            if (state.destroyListeners.get(listener) === reg) {
              listener();
            }
          }),
        );
      } finally {
        state.renderListeners.clear();
        state.updateListeners.clear();
        state.reloadListeners.clear();
        state.globalPropsListeners.clear();
        state.destroyListeners.clear();
        if (
          state.slots.processData
          && host.processData === state.slots.processData
        ) {
          host.processData = defaultProcessData;
        }
        state.slots.processData = undefined;
        if (
          state.slots.getPageData
          && host.getPageData === state.slots.getPageData
        ) {
          host.getPageData = defaultGetPageData;
        }
        state.slots.getPageData = undefined;
        nativeProxy.removeEventListener(
          NATIVE_EVENT_DESTROY_LIFETIME,
          onNativeDestroy,
        );
      }
    };
    nativeProxy.addEventListener(
      NATIVE_EVENT_DESTROY_LIFETIME,
      onNativeDestroy,
    );
  }

  return state;
}

/** @internal */
export function getAliveMTSState(host: HostGlobalScope): MTSHostState {
  const state = initMTSHostState(host);
  if (state.destroyed) {
    throw new Error(
      '[@lynx-js/lynx-runtime/mts] Cannot register or activate a capability on a destroying or destroyed host. Check isDestroyed() before registering in async callbacks.',
    );
  }
  return state;
}

/**
 * True once the MTS host destruction signal (`lynx.getNative()` `__DestroyLifetime`)
 * is observed, before DSL teardown callbacks run.
 *
 * @remarks
 * Observing MTS destruction requires `lynx.getNative()` (**Lynx SDK 3.4+** on Native
 * and Web). On older hosts without `lynx.getNative()` (**Lynx SDK 2.14–3.3** or
 * earlier `web-core`), `isDestroyed()` remains `false`; a `false` return value means
 * destruction has not been observed rather than guaranteeing host liveness.
 *
 * @since Lynx 3.4 (always `false` when host lacks `lynx.getNative()`)
 */
export function isDestroyed(): boolean {
  return isMTSHostDestroyed(globalThis as unknown as HostGlobalScope);
}

/**
 * Subscribe to MTS page destruction (`__DestroyLifetime` on `lynx.getNative()`).
 *
 * @remarks
 * Host destruction notifications on MTS require `lynx.getNative()` (**Lynx SDK 3.4+**
 * on Native and Web). On **Lynx SDK 2.14–3.3** or earlier `web-core` without
 * `lynx.getNative()`, calling `onDestroy` safely degrades to a no-op and returns an
 * idempotent `Unsubscribe` function without throwing, because the single-page context
 * is torn down as a whole without an MTS destroy event.
 *
 * Note: `ReloadTemplate` / `ReloadFromJS` (`globalThis.removeComponents` + `onReload`)
 * reuses the same MTS context and does **not** dispatch `__DestroyLifetime`.
 * Runtime objects recreated across reloads or entry re-evaluations must invoke
 * the returned `Unsubscribe` disposer when retiring so listeners do not accumulate
 * until page teardown.
 *
 * @param listener - Callback invoked synchronously when MTS destruction begins.
 * @returns An idempotent disposer that unsubscribes `listener` (no-op when the host does not emit MTS destroy notifications).
 * @since Lynx 3.4 (safe no-op when host lacks `lynx.getNative()`)
 */
export function onDestroy(listener: () => void): Unsubscribe {
  const state = getAliveMTSState(globalThis as unknown as HostGlobalScope);
  if (!state.hasDestroyProxy) {
    return noop;
  }
  return subscribeListener(state.destroyListeners, listener);
}
