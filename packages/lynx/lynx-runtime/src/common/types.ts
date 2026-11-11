// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** Idempotently remove this registration; does not destroy its page or restore a previous owner. */
export type Unsubscribe = () => void;

export interface LynxSystemInfo {
  platform?: string | undefined;
  pixelRatio?: number | undefined;
  pixelWidth?: number | undefined;
  pixelHeight?: number | undefined;
  lynxSdkVersion?: string | undefined;
  engineVersion?: string | undefined;
  osVersion?: string | undefined;
  runtimeType?: string | undefined;
  theme?: Record<string, unknown> | undefined;
  [key: string]: unknown;
}

export interface CreatePipelineOptions {
  pipelineOrigin?: string | undefined;
  needTimestamps?: boolean | undefined;
  timingFlag?: string | undefined;
  dsl?: string | undefined;
  stage?: string | undefined;
}

export interface PipelineOptions {
  pipelineID?: string | undefined;
  pipelineOrigin?: string | undefined;
  needTimestamps?: boolean | undefined;
  dsl?: string | undefined;
  stage?: string | undefined;
  [key: string]: unknown;
}

/** A successfully created host pipeline, with a usable identifier. */
export interface CreatedPipelineOptions extends PipelineOptions {
  pipelineID: string;
}

export interface MTSRenderOptions {
  processorName?: string | undefined;
  preLoadTemplate?: boolean | undefined;
  pipelineOptions?: PipelineOptions | undefined;
  initPage?: unknown;
}

/**
 * Host pass-through context carried from MTS lifecycle callbacks into `flushElementTree`.
 * Keep this context with its work, including when submission is deferred.
 */
export interface MTSFlushContext {
  /** Preserve the originating host reload context when submitting its changes. */
  reloadTemplate?: boolean | undefined;
  /** Preserve the host update sequence when forwarding or deferring a flush. */
  nativeUpdateDataOrder?: number | undefined;
  pipelineOptions?: PipelineOptions | undefined;
}

/**
 * Context for one host page data update or reset. Keep this context with its work
 * and pass it to `flushElementTree`, including when submission is deferred.
 */
export interface MTSUpdateOptions extends MTSFlushContext {
  /** Replace current page data rather than merging an incremental update. */
  resetPageData?: boolean | undefined;
  processorName?: string | undefined;
  triggerLifeCycle?: boolean | undefined;
}

/**
 * Context for one host template reload on MTS. Keep this context with its work
 * and pass it to `flushElementTree`, including when submission is deferred.
 */
export interface MTSReloadOptions extends MTSUpdateOptions {
  /** Reload the template and replace the initial-input baseline. */
  reloadTemplate?: boolean | undefined;
  /** The host reload originated from JS. */
  reloadFromJS?: boolean | undefined;
}

export interface MTSFlushOptions extends MTSFlushContext {
  /** Timing flag associated with the active performance pipeline. */
  timingFlag?: string | undefined;
  /** Request layout (Native default: true). */
  triggerLayout?: boolean | undefined;
  /** Request the client OnDataUpdated callback (Native default: false). */
  triggerDataUpdated?: boolean | undefined;
  /** Allow the unified pixel pipeline to skip resolving an empty patch. */
  emptyPatch?: boolean | undefined;
}

export interface BTSUpdateOptions {
  /** Replace current page data rather than merging an incremental update. */
  resetPageData?: boolean | undefined;
  processorName?: string | undefined;
}

export interface BTSReloadOptions {
  processorName?: string | undefined;
}

export type BTSEventHandler<T = unknown> = (
  this: void,
  handlerName: string,
  data: T,
  componentId?: string,
) => unknown;

/** Capabilities bound to one host App instance; retain this handle across asynchronous work. */
export interface BTSPageRuntime {
  /**
   * True from the start of BTS page destruction, including inside teardown callbacks.
   *
   * @since Lynx 2.14
   */
  isDestroyed(this: void): boolean;
  getSystemInfo(this: void): Readonly<LynxSystemInfo>;
  createPipeline(
    this: void,
    options?: CreatePipelineOptions,
  ): CreatedPipelineOptions | undefined;
  markTiming(
    this: void,
    pipeline: string | PipelineOptions | undefined,
    timingKey: string,
  ): void;
  /** Host ID captured at binding; empty when the host provides no ID. */
  getId(this: void): string;
  /**
   * Detached records and arrays for mutable DSL state; opaque values remain shared.
   * Overlays the current round's processed initial or `onReload` `TemplateData`
   * onto the template's static `_params.initData` (`encoded_data`), replacing
   * previous dynamic keys across reloads while preserving static template keys.
   * Incremental updates do not change this baseline. Remains readable after destruction.
   */
  getInitData<T = Record<string, unknown>>(this: void): T;
  /**
   * Borrow the captured host GlobalProps snapshot without copying on each read
   * (defaults to `{}` when the host has not injected GlobalProps).
   * Treat the entire value as read-only, including nested objects; Readonly is
   * shallow and no freeze is applied. If a DSL mutates its own root GlobalProps
   * object in place (e.g. via `Object.assign`), shallow-copy
   * `{ ...page.getGlobalProps() }` during bootstrap.
   * The first read or subscription activates capture; do this synchronously during
   * bootstrap to capture subsequent updates. Remains readable after destruction.
   */
  getGlobalProps<T = Record<string, unknown>>(this: void): Readonly<T>;
  /** Subscribe during bootstrap; activates snapshot capture without replaying earlier notifications. */
  onGlobalPropsChanged<T = Record<string, unknown>>(
    this: void,
    listener: (globalProps: Readonly<T>) => void,
  ): Unsubscribe;
  /**
   * Subscribe to host incremental data updates and `resetPageData` replacements on BTS.
   *
   * @remarks
   * Subscribes directly to the page's `tt.updateCardData` callback without an
   * MTS-to-BTS forwarding bridge. On Native `.lynxml` bundles (where C++ currently
   * configures legacy `PackageInstanceDSL::REACT` and skips `tt.updateCardData`),
   * BTS `onUpdateData` does not fire until the host converges `.lynxml` to
   * `REACT_NODIFF` (Web is unaffected; `getInitData` and `onReload` remain active).
   * Payloads are read-only. The DSL owns merge/reset state and rendering;
   * registering a listener does not replay earlier updates.
   */
  onUpdateData<T = Record<string, unknown>>(
    this: void,
    listener: (data: Readonly<T>, options: Readonly<BTSUpdateOptions>) => void,
  ): Unsubscribe;
  /**
   * Subscribe to host template reloads on BTS (`tt.onAppReload`).
   * Runtime refreshes `getInitData()` by overlaying the reload payload onto
   * template static `_params.initData` before invoking listeners.
   * A reload notification alone does not destroy the bound App or retire DSL resources.
   */
  onReload<T = Record<string, unknown>>(
    this: void,
    listener: (data: Readonly<T>, options: Readonly<BTSReloadOptions>) => void,
  ): Unsubscribe;
  onConfigChanged<T = Record<string, unknown>>(
    this: void,
    listener: (config: Readonly<T>) => void,
  ): Unsubscribe;
  onEnterForeground(this: void, listener: () => void): Unsubscribe;
  onEnterBackground(this: void, listener: () => void): Unsubscribe;
  /**
   * Subscribe to host global events delivered to this page's `GlobalEventEmitter`
   * (such as client `sendGlobalEvent`, `exposure` / `disexposure`, and
   * `keyboardstatuschanged`) while the page and emitter are available.
   *
   * @remarks
   * Resolves `GlobalEventEmitter` from the bound page so asynchronous subscriptions
   * in a shared `LynxGroup` context remain isolated from peer pages. Shares one host
   * listener per event `name` on this page, deduplicates identical `(name, listener)`
   * callbacks, forwards all positional arguments with `undefined` `this`, and removes
   * all listeners before DSL `onDestroy` callbacks run. Does not replay earlier events
   * or validate `Args` at runtime; dispose when an owning entry retires across in-place
   * reloads (`onReload`).
   */
  onGlobalEvent<Args extends unknown[] = unknown[]>(
    this: void,
    name: string,
    listener: (this: void, ...args: Args) => void,
  ): Unsubscribe;
  /**
   * Claim both raw page and component event slots with one synchronous handler.
   * Latest registration wins; disposal clears the current handler without restoring
   * an earlier owner. Page events have no componentId; component events retain it.
   * Return values and exceptions pass through to the host; Promises are not awaited
   * and false is ordinary data, not cancellation. Register only while the page is alive.
   */
  setEventHandler<T = unknown>(
    this: void,
    handler: BTSEventHandler<T>,
  ): Unsubscribe;
  /**
   * Send to this bound page's MTS; returns no receipt and does not wait for execution.
   * Requires a live page and its host peer proxy. Install the receiver before sending:
   * there is no startup queue, retry, RPC, or cross-type ordering guarantee.
   * T constrains the caller only; it does not validate the peer's payload.
   */
  sendMessage<T = undefined>(
    this: void,
    type: string,
    ...args: undefined extends T ? [data?: T] : [data: T]
  ): void;
  /**
   * Subscribe to raw payloads from this page's MTS while the page and proxy are available.
   * Identical callbacks for a type share a registration. Dispose when the owning entry
   * retires; page destruction also removes listeners. No replay or payload validation.
   * Prefer object payloads: Web converts top-level null/undefined to an empty object.
   */
  onMessage<T = unknown>(
    this: void,
    type: string,
    listener: (this: void, data: T) => void,
  ): Unsubscribe;
  /**
   * Subscribe to BTS page destruction.
   *
   * @remarks
   * Supported across **Lynx SDK 2.14+** on Native (`tt.callDestroyLifetimeFun` /
   * `Native.__DestroyLifetime`) and on Web. Use this hook to deterministically
   * release page-scoped timers, subscriptions, and shared `LynxGroup` background
   * resources when a page instance is destroyed.
   *
   * Host template reload (`onReload`) does **not** trigger host destruction unless
   * the DSL explicitly invokes `callDestroyLifetimeFun()` before `reloadCard()`.
   * Runtime objects recreated across in-place reloads must invoke the returned
   * `Unsubscribe` disposer when retiring so listeners do not accumulate.
   *
   * @param listener - Callback invoked synchronously when BTS page destruction begins.
   * @returns An idempotent disposer that unsubscribes `listener`.
   * @since Lynx 2.14
   */
  onDestroy(this: void, listener: () => void): Unsubscribe;
}

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
