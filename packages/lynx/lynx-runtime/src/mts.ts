// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { clearMessages, subscribeMessage } from './common/messages.js';
import type { MessageSubscriptions } from './common/messages.js';
import { createHostPipeline, markHostTiming } from './common/performance.js';
import {
  NATIVE_EVENT_DESTROY_LIFETIME,
  NATIVE_EVENT_RENDER_PAGE,
  NATIVE_EVENT_UPDATE_GLOBAL_PROPS,
  NATIVE_EVENT_UPDATE_PAGE,
  copyHostData,
  dispatchListeners,
  invokeAll,
  isPlainRecord,
  subscribeListener,
} from './common/protocol.js';
import type {
  CreatePipelineOptions,
  CreatedPipelineOptions,
  HostContextProxy,
  HostGlobalScope,
  HostMessageEvent,
  LynxSystemInfo,
  MTSFlushContext,
  MTSFlushOptions,
  MTSReloadOptions,
  MTSRenderOptions,
  MTSUpdateOptions,
  PipelineOptions,
  Unsubscribe,
} from './common/types.js';

export type {
  CreatedPipelineOptions,
  CreatePipelineOptions,
  LynxSystemInfo,
  MTSFlushContext,
  MTSFlushOptions,
  MTSReloadOptions,
  MTSRenderOptions,
  MTSUpdateOptions,
  PipelineOptions,
  Unsubscribe,
};

type MTSInputGlobalKey = 'renderPage' | 'updatePage' | 'updateGlobalProps';
type MTSSingleOwnerKey = 'processData' | 'getPageData';

interface DestroyLifetime {
  listeners: Map<() => void, Unsubscribe>;
  states: Set<MTSHostState>;
  state: MTSHostState;
  destroying: boolean;
  destroyed: boolean;
}

interface MTSHostState {
  destroying: boolean;
  destroyed: boolean;
  lifetimeIsWeb?: boolean | undefined;
  lifetimeGetter?: (() => HostContextProxy | undefined) | undefined;
  lifetime?: DestroyLifetime | undefined;
  jsContextGetter?: (() => HostContextProxy | undefined) | undefined;
  jsContext?: HostContextProxy | undefined;
  globalProps: Record<string, unknown>;
  initData: Record<string, unknown>;
  pageInputsInstalled: boolean;
  globalPropsInstalled: boolean;
  inputs: Partial<
    Record<MTSInputGlobalKey, HostGlobalScope[MTSInputGlobalKey]>
  >;
  slots: {
    [K in MTSSingleOwnerKey]?: HostGlobalScope[K];
  };
  listeners: Map<
    string,
    Map<(data: unknown, options: unknown) => void, Unsubscribe>
  >;
  cleanups: Unsubscribe[];
  messages: MessageSubscriptions;
}

const MTS_STORE_SYMBOL = Symbol.for('@lynx-js/lynx-runtime/mts');
const MTS_EVENT_RELOAD_PAGE = '__ReloadPage';
const defaultProcessData = <T>(data: T): T => data;
const defaultGetPageData = (): null => null;
const noop = (): void => {
  // Safe default for unhandled Native input entrypoints.
};

interface MTSRuntimeStore {
  mtsStateMap: WeakMap<object, MTSHostState>;
  destroyListenersMap: WeakMap<HostContextProxy, DestroyLifetime>;
}

let hasTrackedLifetimes = false;

function peekMTSStore(host: HostGlobalScope): MTSRuntimeStore | undefined {
  return (host as unknown as Record<symbol, MTSRuntimeStore | undefined>)[
    MTS_STORE_SYMBOL
  ];
}

function getMTSStore(host: HostGlobalScope): MTSRuntimeStore {
  let store = peekMTSStore(host);
  if (!store) {
    store = {
      mtsStateMap: new WeakMap(),
      destroyListenersMap: new WeakMap(),
    };
    Object.defineProperty(host, MTS_STORE_SYMBOL, {
      value: store,
      configurable: true,
    });
  }
  return store;
}

function getMTSHostState(host: HostGlobalScope): MTSHostState {
  const store = getMTSStore(host);
  const key = host.lynx ?? host;
  let state = store.mtsStateMap.get(key);
  if (!state) {
    const proxy = getDestroyProxy(host);
    state = proxy ? store.destroyListenersMap.get(proxy)?.state : undefined;
    if (state) store.mtsStateMap.set(key, state);
    if (!state) {
      state = {
        destroying: false,
        destroyed: false,
        globalProps: {},
        initData: {},
        pageInputsInstalled: false,
        globalPropsInstalled: false,
        inputs: {},
        slots: {},
        listeners: new Map(),
        cleanups: [],
        messages: new Map(),
      };
      store.mtsStateMap.set(key, state);
      associateHostLifetime(host, store, state, { proxy });
      return state;
    }
  }
  associateHostLifetime(host, store, state);
  return state;
}

function getAliveMTSState(host: HostGlobalScope): MTSHostState {
  const state = getMTSHostState(host);
  if (state.destroying || state.destroyed) {
    throw new Error(
      '[@lynx-js/lynx-runtime/mts] Cannot register or activate a capability on a destroying or destroyed host.',
    );
  }
  return state;
}

function syncMTSInitData(state: MTSHostState, data: unknown): void {
  state.initData = isPlainRecord(data) ? copyHostData(data) : {};
}

function syncMTSGlobalProps(host: HostGlobalScope, data: unknown): void {
  const next = isPlainRecord(data) ? data : {};
  if (host.lynx) {
    host.lynx.__globalProps = next;
  }
}

/**
 * Ensure C++ `QuickContext::GetAndCall` (`try_call = false`) entrypoints on MTS
 * always have safe function defaults once an MTS input/hook capability activates,
 * without overwriting pre-existing DSL handlers on unclaimed channels.
 */
function ensureMTSHostSlots(host: HostGlobalScope, state: MTSHostState): void {
  for (
    const globalKey of [
      'renderPage',
      'updatePage',
      'updateGlobalProps',
    ] as const
  ) {
    const onInput = state.inputs[globalKey];
    if (onInput) {
      if (host[globalKey] !== onInput) {
        host[globalKey] = onInput;
      }
    } else {
      host[globalKey] ??= noop;
    }
  }
  if (isPlainRecord(host.lynx?.SystemInfo) && !isPlainRecord(host.SystemInfo)) {
    // Native updates global SystemInfo.pixelRatio in place after initialization.
    host.SystemInfo = host.lynx.SystemInfo;
  }
  host.processData ??= defaultProcessData;
  host.removeComponents ??= noop;
  host.getPageData ??= defaultGetPageData;
}

function resolveSystemInfo(host: HostGlobalScope): LynxSystemInfo {
  if (isPlainRecord(host.lynx?.SystemInfo)) return host.lynx.SystemInfo;
  if (isPlainRecord(host.SystemInfo)) return host.SystemInfo;
  return {};
}

function isMTSHostDestroyed(host: HostGlobalScope): boolean {
  const store = peekMTSStore(host);
  if (!store) return false;
  const state = store.mtsStateMap.get(host.lynx ?? host);
  if (state) {
    const isWeb = resolveSystemInfo(host).platform === 'web';
    const getter = isWeb ? host.lynx?.getEngine : host.lynx?.getNative;
    if (state.lifetimeIsWeb === isWeb && state.lifetimeGetter === getter) {
      return state.destroying || state.destroyed;
    }
  }
  if (!hasTrackedLifetimes) {
    return state?.destroying === true || state?.destroyed === true;
  }
  const proxy = getDestroyProxy(host);
  const lifetime = proxy && store.destroyListenersMap.get(proxy);
  return state?.destroying === true || state?.destroyed === true
    || lifetime?.destroying === true || lifetime?.destroyed === true;
}

/** Read live host environment information without claiming MTS input slots. */
export function getSystemInfo(): Readonly<LynxSystemInfo> {
  const host = globalThis as unknown as HostGlobalScope;
  if (
    !isMTSHostDestroyed(host)
    && isPlainRecord(host.lynx?.SystemInfo)
    && !isPlainRecord(host.SystemInfo)
  ) {
    // Native UpdateScreenMetrics updates global `SystemInfo.pixelRatio` in place.
    host.SystemInfo = host.lynx.SystemInfo;
  }
  return resolveSystemInfo(host);
}

/**
 * True once the MTS host destruction signal is observed, before DSL teardown callbacks run.
 *
 * @remarks
 * Observing MTS destruction requires **Lynx SDK 3.4+** on Native (`lynx.getNative()`)
 * or **`@lynx-js/web-core` 0.24.0+** on Web (`lynx.getEngine()`). On older hosts
 * without an MTS destruction proxy (**Lynx SDK 2.14–3.3** or earlier `web-core`),
 * `isDestroyed()` remains `false`; a `false` return value means destruction has
 * not been observed rather than guaranteeing host liveness.
 *
 * @since Lynx 3.4 / `@lynx-js/web-core` 0.24.0 (always `false` when host lacks MTS destroy proxy)
 */
export function isDestroyed(): boolean {
  return isMTSHostDestroyed(globalThis as unknown as HostGlobalScope);
}

/** Create a host performance pipeline without imposing DSL timing stages. */
export function createPipeline(
  options?: CreatePipelineOptions,
): CreatedPipelineOptions | undefined {
  const host = globalThis as unknown as HostGlobalScope;
  if (isMTSHostDestroyed(host)) return undefined;
  return createHostPipeline(host.lynx?.performance, options, 'mts');
}

/** Mark a host timing key; the DSL decides whether a key needs timestamps. */
export function markTiming(
  pipeline: string | PipelineOptions | undefined,
  timingKey: string,
): void {
  const host = globalThis as unknown as HostGlobalScope;
  if (isMTSHostDestroyed(host)) return;
  markHostTiming(host.lynx?.performance, pipeline, timingKey);
}

function getDestroyProxy(host: HostGlobalScope): HostContextProxy | undefined {
  const lynx = host.lynx;
  if (!lynx) return undefined;
  const isWeb = resolveSystemInfo(host).platform === 'web';
  return isWeb ? lynx.getEngine?.() : lynx.getNative?.();
}

/**
 * Subscribe to MTS page destruction (`__DestroyLifetime` on Native `lynx.getNative()`
 * or Web `lynx.getEngine()`).
 *
 * @remarks
 * Host destruction notifications on MTS require **Lynx SDK 3.4+** on Native
 * (where `lynx.getNative()` dispatches `__DestroyLifetime`) or
 * **`@lynx-js/web-core` 0.24.0+** on Web (`lynx.getEngine()`). On **Lynx SDK 2.14–3.3**
 * or earlier `web-core` (without an MTS destruction proxy), calling `onDestroy`
 * safely degrades to a no-op and returns an idempotent `Unsubscribe` function
 * without throwing, because the single-page context is torn down as a whole
 * without an MTS destroy event.
 *
 * Note: `globalThis.removeComponents` is called by C++ during `ReloadTemplate` /
 * `ReloadFromJS` immediately before `UpdateTemplate`, NOT on page destroy, so it
 * must not trigger `onDestroy`.
 *
 * @param listener - Callback invoked synchronously when MTS destruction begins.
 * @returns An idempotent disposer that unsubscribes `listener` (no-op when the host does not emit MTS destroy notifications).
 * @since Lynx 3.4 / `@lynx-js/web-core` 0.24.0 (safe no-op when host lacks MTS destroy proxy)
 */
export function onDestroy(listener: () => void): Unsubscribe {
  const host = globalThis as unknown as HostGlobalScope;
  const state = getAliveMTSState(host);
  if (!state.lifetime) {
    return noop;
  }
  return subscribeListener(state.lifetime.listeners, listener);
}

function cleanupMTSState(host: HostGlobalScope, state: MTSHostState): void {
  const cleanups = state.cleanups.splice(0);
  cleanups.push(() => {
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
  });
  invokeAll(cleanups);
}

function associateHostLifetime(
  host: HostGlobalScope,
  store: MTSRuntimeStore,
  state: MTSHostState,
  initial?: { proxy: HostContextProxy | undefined },
): void {
  const isWeb = resolveSystemInfo(host).platform === 'web';
  const getter = isWeb ? host.lynx?.getEngine : host.lynx?.getNative;
  if (
    !initial
    && state.lifetimeIsWeb === isWeb
    && state.lifetimeGetter === getter
  ) {
    return;
  }
  state.lifetimeIsWeb = isWeb;
  state.lifetimeGetter = getter;
  const nativeProxy = initial ? initial.proxy : getDestroyProxy(host);
  if (!nativeProxy) {
    state.lifetime = undefined;
    return;
  }
  let registration = store.destroyListenersMap.get(nativeProxy);
  if (!registration) {
    const lifetime: DestroyLifetime = {
      listeners: new Map<() => void, Unsubscribe>(),
      states: new Set<MTSHostState>(),
      state,
      destroying: false,
      destroyed: false,
    };
    registration = lifetime;
    store.destroyListenersMap.set(nativeProxy, lifetime);
    const onNativeDestroy = (): void => {
      lifetime.destroying = true;
      for (const boundState of lifetime.states) {
        const liveProps = host.lynx?.__globalProps;
        boundState.globalProps = isPlainRecord(liveProps)
          ? copyHostData(liveProps)
          : {};
        boundState.destroying = true;
      }
      try {
        // Stop communication before user teardown; restore inputs and owners after it.
        invokeAll([
          ...[...lifetime.states].map(boundState => () => {
            clearMessages(boundState.messages);
          }),
          () => dispatchListeners(lifetime.listeners, listener => listener()),
        ]);
      } finally {
        try {
          invokeAll(
            [...lifetime.states].map(boundState => () => {
              cleanupMTSState(host, boundState);
            }),
          );
        } finally {
          nativeProxy.removeEventListener(
            NATIVE_EVENT_DESTROY_LIFETIME,
            onNativeDestroy,
          );
          lifetime.listeners.clear();
          for (const boundState of lifetime.states) {
            boundState.destroying = false;
            boundState.destroyed = true;
          }
          lifetime.states.clear();
          lifetime.destroying = false;
          lifetime.destroyed = true;
        }
      }
    };
    nativeProxy.addEventListener(
      NATIVE_EVENT_DESTROY_LIFETIME,
      onNativeDestroy,
    );
  }
  hasTrackedLifetimes = true;
  state.lifetime = registration;
  state.destroying = registration.destroying;
  state.destroyed = registration.destroyed;
  if (!registration.destroyed) registration.states.add(state);
}

function getJSContext(
  host: HostGlobalScope,
  state: MTSHostState,
): HostContextProxy {
  const getter = host.lynx?.getJSContext;
  if (getter && getter === state.jsContextGetter && state.jsContext) {
    return state.jsContext;
  }
  const proxy = host.lynx?.getJSContext?.();
  if (!proxy) {
    throw new Error(
      '[@lynx-js/lynx-runtime/mts] Message communication requires lynx.getJSContext().',
    );
  }
  if (state.jsContext && state.jsContext !== proxy) {
    clearMessages(state.messages);
  }
  state.jsContextGetter = getter;
  state.jsContext = proxy;
  return proxy;
}

/** Submit the page tree; returning does not imply layout or paint completion. */
export function flushElementTree(options?: Readonly<MTSFlushOptions>): void {
  const host = globalThis as unknown as HostGlobalScope;
  getAliveMTSState(host);
  const flush = host.__FlushElementTree;
  if (typeof flush !== 'function') {
    throw new Error(
      '[@lynx-js/lynx-runtime/mts] Page flush requires __FlushElementTree().',
    );
  }
  if (options === undefined) {
    // Call 0-arg __FlushElementTree() directly when no options are provided.
    flush();
    return;
  }
  if (!isPlainRecord(options as unknown)) {
    throw new TypeError(
      '[@lynx-js/lynx-runtime/mts] Flush options must be a plain object.',
    );
  }
  const rawOptions = options as Readonly<
    MTSFlushOptions & {
      __lynx_timing_flag?: string | undefined;
    }
  >;
  flush(
    undefined,
    rawOptions.timingFlag !== undefined
      && rawOptions.__lynx_timing_flag === undefined
      ? { ...rawOptions, __lynx_timing_flag: rawOptions.timingFlag }
      : rawOptions,
  );
}

/** Send a named message to this page's BTS without a completion receipt. */
export function sendMessage<T = undefined>(
  type: string,
  ...args: undefined extends T ? [data?: T] : [data: T]
): void;
export function sendMessage(type: string, data?: unknown): void {
  const host = globalThis as unknown as HostGlobalScope;
  const state = getAliveMTSState(host);
  getJSContext(host, state).dispatchEvent({ type, data });
}

/** Subscribe to named messages from this page's BTS, preserving the raw payload. */
export function onMessage<T = unknown>(
  type: string,
  listener: (this: void, data: T) => void,
): Unsubscribe {
  const host = globalThis as unknown as HostGlobalScope;
  const state = getAliveMTSState(host);
  const proxy = getJSContext(host, state);
  return subscribeMessage(state.messages, proxy, type, listener);
}

/**
 * Runtime owns claimed Native input channels for the lifetime of the host,
 * capturing page inputs or GlobalProps independently of whether other MTS
 * capabilities (such as flushElementTree or peer messaging) are used.
 * Engine events do not call legacy globals: Native's two routes are exclusive.
 */
function ensureMTSPageInputs(
  host: HostGlobalScope,
  state: MTSHostState,
): void {
  if (!state.pageInputsInstalled) {
    state.pageInputsInstalled = true;
    const engine = host.lynx?.getEngine?.();
    state.cleanups.push(
      installMTSInputChannel(
        host,
        state,
        engine,
        NATIVE_EVENT_RENDER_PAGE,
        'renderPage',
      ),
      installMTSInputChannel(
        host,
        state,
        engine,
        NATIVE_EVENT_UPDATE_PAGE,
        'updatePage',
      ),
    );
  }
  ensureMTSHostSlots(host, state);
}

function ensureMTSGlobalPropsInput(
  host: HostGlobalScope,
  state: MTSHostState,
): void {
  if (!state.globalPropsInstalled) {
    state.globalPropsInstalled = true;
    const engine = host.lynx?.getEngine?.();
    state.cleanups.push(
      installMTSInputChannel(
        host,
        state,
        engine,
        NATIVE_EVENT_UPDATE_GLOBAL_PROPS,
        'updateGlobalProps',
      ),
    );
  }
  ensureMTSHostSlots(host, state);
}

function installMTSInputChannel(
  host: HostGlobalScope,
  state: MTSHostState,
  engine: HostContextProxy | undefined,
  eventName: string,
  globalKey: 'renderPage' | 'updatePage' | 'updateGlobalProps',
): Unsubscribe {
  const listeners = new Map<
    (data: unknown, options: unknown) => void,
    Unsubscribe
  >();
  state.listeners.set(eventName, listeners);
  const reloadListeners = eventName === NATIVE_EVENT_UPDATE_PAGE
    ? new Map<(data: unknown, options: unknown) => void, Unsubscribe>()
    : undefined;
  if (reloadListeners) {
    state.listeners.set(MTS_EVENT_RELOAD_PAGE, reloadListeners);
  }
  const dispatchInput = (
    targetState: MTSHostState,
    data: Record<string, unknown> = {},
    options?: MTSRenderOptions & MTSReloadOptions,
  ): void => {
    if (targetState.destroying || targetState.destroyed) return;
    const isReload = eventName === NATIVE_EVENT_UPDATE_PAGE
      && Boolean(options?.reloadTemplate);
    if (eventName === NATIVE_EVENT_RENDER_PAGE || isReload) {
      syncMTSInitData(targetState, data);
    } else if (eventName === NATIVE_EVENT_UPDATE_GLOBAL_PROPS) {
      syncMTSGlobalProps(host, data);
    }
    const targetListeners = targetState.listeners.get(
      isReload ? MTS_EVENT_RELOAD_PAGE : eventName,
    );
    if (!targetListeners) return;
    dispatchListeners(targetListeners, listener =>
      listener(
        data,
        eventName === NATIVE_EVENT_UPDATE_GLOBAL_PROPS
          ? options
          : options ?? {},
      ));
  };
  const onInput = (
    data: Record<string, unknown> = {},
    options?: MTSRenderOptions & MTSReloadOptions,
  ): void => {
    dispatchInput(
      host.lynx === undefined ? state : getMTSHostState(host),
      data,
      options,
    );
  };
  const previous = host[globalKey];
  state.inputs[globalKey] = onInput;
  host[globalKey] = onInput;
  const onEvent = createEngineInputListener((data, options) => {
    dispatchInput(state, data, options);
  });
  engine?.addEventListener(eventName, onEvent);
  return () => {
    engine?.removeEventListener(eventName, onEvent);
    listeners.clear();
    reloadListeners?.clear();
    delete state.inputs[globalKey];
    if (host[globalKey] === onInput) {
      host[globalKey] = previous ?? noop;
    }
  };
}

function createEngineInputListener(
  onInput: (
    data: Record<string, unknown>,
    options?: MTSRenderOptions & MTSReloadOptions,
  ) => void,
): (event: HostMessageEvent<unknown>) => void {
  return (event) => {
    const raw = Array.isArray(event.data) ? event.data : [event.data];
    onInput(
      (raw[0] ?? {}) as Record<string, unknown>,
      raw[1] as (MTSRenderOptions & MTSReloadOptions) | undefined,
    );
  };
}

function subscribeMTSPageInput<TData, TOptions>(
  eventName: string,
  listener: (data: TData, options: TOptions) => void,
): Unsubscribe {
  const host = globalThis as unknown as HostGlobalScope;
  const state = getAliveMTSState(host);
  ensureMTSPageInputs(host, state);
  const listeners = state.listeners.get(eventName)!;
  const callback = listener as (data: unknown, options: unknown) => void;
  return subscribeListener(listeners, callback);
}

function registerSingleOwnerSlot<
  K extends MTSSingleOwnerKey,
  TFn extends NonNullable<HostGlobalScope[K]>,
>(
  slotKey: K,
  defaultFn: TFn,
  handler: TFn,
): Unsubscribe {
  const host = globalThis as unknown as HostGlobalScope;
  const state = getAliveMTSState(host);
  ensureMTSHostSlots(host, state);
  state.slots[slotKey] = handler;
  host[slotKey] = handler;
  return () => {
    if (state.slots[slotKey] !== handler) {
      return;
    }
    state.slots[slotKey] = undefined;
    if (host[slotKey] === handler) {
      host[slotKey] = defaultFn;
    }
  };
}

/**
 * Read a detached copy of the initial page data records and arrays on MTS.
 * Opaque objects remain shared by reference.
 * Updated on first-screen `renderPage` and on `reloadTemplate` updates,
 * and isolated from runtime mutations to `lynx.__initData`.
 */
export function getInitData<T = Record<string, unknown>>(): T {
  const host = globalThis as unknown as HostGlobalScope;
  const state = getMTSHostState(host);
  if (!state.destroying && !state.destroyed) {
    ensureMTSPageInputs(host, state);
  }
  return copyHostData(state.initData) as T;
}

/**
 * Borrow the current host `GlobalProps` without copying (defaults to `{}` when unset).
 * Treat the entire value as read-only, including nested objects; Readonly is shallow
 * and no freeze is applied. During and after destruction, read the captured final properties.
 */
export function getGlobalProps<T = Record<string, unknown>>(): Readonly<T> {
  const host = globalThis as unknown as HostGlobalScope;
  const state = getMTSHostState(host);
  if (state.destroying || state.destroyed) {
    return state.globalProps as Readonly<T>;
  }
  ensureMTSGlobalPropsInput(host, state);
  const live = host.lynx?.__globalProps;
  return (isPlainRecord(live) ? live : state.globalProps) as Readonly<T>;
}

/**
 * Subscribe to first-screen render on MTS.
 */
export function onRenderPage<T = Record<string, unknown>>(
  listener: (data: Readonly<T>, options: Readonly<MTSRenderOptions>) => void,
): Unsubscribe {
  return subscribeMTSPageInput<Readonly<T>, Readonly<MTSRenderOptions>>(
    NATIVE_EVENT_RENDER_PAGE,
    listener,
  );
}

/**
 * Subscribe to host page data updates and resets on MTS (`!options.reloadTemplate`).
 * `resetPageData` replaces current data rather than merging an incremental update.
 * Preserve these options with the work and pass them to `flushElementTree` when
 * submitting its changes.
 */
export function onUpdateData<T = Record<string, unknown>>(
  listener: (data: Readonly<T>, options: Readonly<MTSUpdateOptions>) => void,
): Unsubscribe {
  return subscribeMTSPageInput<Readonly<T>, Readonly<MTSUpdateOptions>>(
    NATIVE_EVENT_UPDATE_PAGE,
    listener,
  );
}

/**
 * Subscribe to host template reloads on MTS (`options.reloadTemplate === true`).
 * Runtime refreshes `getInitData()` before invoking reload listeners. Preserve
 * these options with the work and pass them to `flushElementTree` when submitting
 * its changes.
 */
export function onReload<T = Record<string, unknown>>(
  listener: (data: Readonly<T>, options: Readonly<MTSReloadOptions>) => void,
): Unsubscribe {
  return subscribeMTSPageInput<Readonly<T>, Readonly<MTSReloadOptions>>(
    MTS_EVENT_RELOAD_PAGE,
    listener,
  );
}

/**
 * Subscribe to host `GlobalProps` updates on MTS.
 * Treat the delivered object as read-only; mutating it affects shared host state.
 */
export function onGlobalPropsChanged<T = Record<string, unknown>>(
  listener: (
    globalProps: Readonly<T>,
    options?: Readonly<MTSFlushContext>,
  ) => void,
): Unsubscribe {
  const host = globalThis as unknown as HostGlobalScope;
  const state = getAliveMTSState(host);
  ensureMTSGlobalPropsInput(host, state);
  const listeners = state.listeners.get(NATIVE_EVENT_UPDATE_GLOBAL_PROPS)!;
  const callback = listener as (data: unknown, options: unknown) => void;
  return subscribeListener(listeners, callback);
}

/**
 * Register the synchronous single-owner MTS host `processData` hook.
 * Native consumes its return value immediately; PromiseLike results are rejected.
 * Normalizes Native's absent `TemplateData` (`undefined` / `null`) to `{}` and
 * empty default `processorName` (`""`) to `undefined` across Native and Web.
 * Registering a new processor replaces the previous active processor; unsubscribing
 * the active processor or destroying the page restores the identity processor.
 */
export function setDataProcessor<
  TInput = Record<string, unknown>,
  TOutput = Record<string, unknown>,
>(
  processor: (
    data: TInput,
    processorName?: string,
  ) => TOutput & ({ then?: never } | null | undefined),
): Unsubscribe {
  return registerSingleOwnerSlot(
    'processData',
    defaultProcessData,
    (data: unknown, processorName?: string): unknown =>
      processor(
        (data ?? {}) as TInput,
        processorName === '' ? undefined : processorName,
      ),
  );
}

/**
 * Register the synchronous single-owner MTS `getPageData` hook
 * (PromiseLike results are rejected),
 * invoked by Native `GetCurrentData` / `GetPageDataByKey` to query the DSL's current state.
 */
export function setPageDataGetter<T = Record<string, unknown>>(
  getter: (keys?: string[]) => (T & { then?: never }) | null,
): Unsubscribe {
  return registerSingleOwnerSlot(
    'getPageData',
    defaultGetPageData,
    (keys?: string[]): unknown => getter(keys),
  );
}
