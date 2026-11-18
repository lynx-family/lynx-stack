/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import type {
  Cloneable,
  ExternalBundleResponse,
  InitI18nResources,
  InvokeUIMethodPAPI,
  JSRealm,
  MainThreadGlobalThis,
  NapiModulesMap,
  NativeModulesMap,
  PageConfig,
} from '../../types/index.js';
import {
  EngineMessageEventType,
  loadUnknownElementEventName,
  systemInfoBase,
} from '../../constants.js';
import { BackgroundThread } from './Background.js';
import { BoundingClientRectService } from './BoundingClientRectService.js';
import { I18nManager } from './I18n.js';
import { IntersectionObserverService } from './IntersectionObserverService.js';
import { WASMJSBinding } from './elementAPIs/WASMJSBinding.js';
import { createInvokeUIMethod } from './elementAPIs/createInvokeUIMethod.js';
import { ExposureServices } from './ExposureServices.js';
import { createElementAPI } from './elementAPIs/createElementAPI.js';
import { cloneIntoRealm } from './createIFrameRealm.js';
import { createMainThreadGlobalAPIs } from './createMainThreadGlobalAPIs.js';
import {
  dispatchEngineEventWithFallback,
  LynxEngineContextImpl,
} from './LynxEngineContext.js';
import { templateManager } from './TemplateManager.js';
import { loadAllWebElements } from '../webElementsDynamicLoader.js';
// @ts-expect-error
import IN_SHADOW_CSS_MODERN from '../../../css/in_shadow.css?inline';
import type { LynxViewElement } from './LynxView.js';
import { requestIdleCallbackImpl } from './utils/requestIdleCallback.js';
loadAllWebElements().catch((e) => {
  console.error('[lynx-web] Failed to load web elements', e);
});

const IN_SHADOW_CSS = URL.createObjectURL(
  new Blob([IN_SHADOW_CSS_MODERN], { type: 'text/css' }),
);
const linkElement = document.createElement('link');
linkElement.rel = 'stylesheet';
linkElement.href = IN_SHADOW_CSS;
linkElement.type = 'text/css';
linkElement.fetchPriority = 'high';
linkElement.blocking = 'render';
const pixelRatio = window.devicePixelRatio;
const screenWidth = window.screen.availWidth * pixelRatio;
const screenHeight = window.screen.availHeight * pixelRatio;
export function createSystemInfo(
  browserConfig?: Record<string, any>,
): Record<string, any> {
  return Object.freeze({
    ...systemInfoBase,
    // some information only available on main thread, we should read and pass to worker
    pixelRatio,
    pixelWidth: screenWidth,
    pixelHeight: screenHeight,
    ...browserConfig,
  });
}

export class LynxViewInstance implements AsyncDisposable {
  readonly mainThreadGlobalThis: MainThreadGlobalThis;
  readonly mtsWasmBinding: WASMJSBinding;
  readonly backgroundThread: BackgroundThread;
  readonly isProfiling: boolean;
  readonly i18nManager: I18nManager;
  readonly exposureServices: ExposureServices;
  readonly intersectionObserverService: IntersectionObserverService;
  readonly webElementsLoadingPromises: Promise<void>[] = [];
  /**
   * The Engine context proxy handed to main-thread scripts via
   * `lynx.getEngine()`. Buildless cards subscribe here for engine lifecycle
   * events; see {@link dispatchEngineEvent} for the fallback semantics that
   * keep `globalThis.renderPage`-style bundles working.
   */
  readonly engineContext: LynxEngineContextImpl = new LynxEngineContextImpl();

  // A `.web.bundle` url is only ever loaded one way — as a lazy component
  // (`queryComponent`) or as an external bundle (`loadExternalBundle`), never
  // both — so both share a single per-url promise cache.
  #bundleLoadCache: Map<string, Promise<unknown>> = new Map();
  #pageConfig?: PageConfig;
  #nativeModulesMap: NativeModulesMap;
  #napiModulesMap: NapiModulesMap;

  readonly boundingClientRectService: BoundingClientRectService;
  readonly invokeUIMethod: InvokeUIMethodPAPI;

  get lynxViewClientLeft(): number {
    return this.boundingClientRectService.getLynxViewRect().left;
  }

  get lynxViewClientTop(): number {
    return this.boundingClientRectService.getLynxViewRect().top;
  }

  lepusCodeUrls = new Map<string, Record<string, string>>();
  systemInfo: Record<string, any>;

  readonly initData: Cloneable;
  globalprops: Cloneable;

  constructor(
    public readonly parentDom: LynxViewElement,
    initData: Cloneable,
    globalprops: Cloneable,
    public readonly templateUrl: string,
    public readonly rootDom: ShadowRoot,
    public readonly mtsRealm: JSRealm,
    private isSSR: boolean,
    lynxGroupId: number | undefined,
    nativeModulesMap: NativeModulesMap = {},
    napiModulesMap: NapiModulesMap = {},
    initI18nResources?: InitI18nResources,
    private readonly transformVW: boolean = false,
    private readonly transformVH: boolean = false,
    private readonly transformREM: boolean = false,
    browserConfig?: Record<string, any>,
  ) {
    this.isProfiling = parentDom.isProfiling;
    this.systemInfo = createSystemInfo(browserConfig);
    if (!isSSR) {
      this.rootDom.append(linkElement.cloneNode(false));
    }
    this.#nativeModulesMap = nativeModulesMap;
    this.#napiModulesMap = napiModulesMap;
    this.mainThreadGlobalThis = mtsRealm.globalWindow as
      & typeof globalThis
      & MainThreadGlobalThis;
    this.initData = cloneIntoRealm(initData, mtsRealm.globalWindow);
    this.globalprops = cloneIntoRealm(globalprops, mtsRealm.globalWindow);

    this.boundingClientRectService = new BoundingClientRectService(parentDom);
    this.invokeUIMethod = createInvokeUIMethod(this.boundingClientRectService);
    this.backgroundThread = new BackgroundThread(lynxGroupId, this);
    this.i18nManager = new I18nManager(
      this.backgroundThread,
      this.rootDom,
      initI18nResources,
    );
    this.mtsWasmBinding = new WASMJSBinding(
      this,
    );
    this.exposureServices = new ExposureServices(
      this,
    );
    this.intersectionObserverService = new IntersectionObserverService(this);
    this.backgroundThread.markTiming('create_lynx_start');
  }

  onPageConfigReady(config: PageConfig) {
    if (this.#pageConfig) {
      return;
    }
    // create element APIs
    this.#pageConfig = config;
    const enableCSSSelector = config['enableCSSSelector'] == 'true';
    const defaultDisplayLinear = config['defaultDisplayLinear'] == 'true';
    const defaultOverflowVisible = config['defaultOverflowVisible'] == 'true';
    Object.assign(
      this.mtsRealm.globalWindow,
      createElementAPI(
        this.rootDom,
        this.mtsWasmBinding,
        enableCSSSelector,
        defaultDisplayLinear,
        defaultOverflowVisible,
        this.transformVW,
        this.transformVH,
        this.transformREM,
        config['enableCSSInheritance'] === 'true',
      ),
      createMainThreadGlobalAPIs(
        this,
      ),
    );
  }

  onStyleInfoReady(
    currentUrl: string,
  ) {
    if (this.mtsWasmBinding.wasmContext) {
      const resource = templateManager.getStyleSheet(currentUrl);
      if (resource) {
        this.mtsWasmBinding.wasmContext.push_style_sheet(
          resource,
          this.templateUrl === currentUrl ? undefined : currentUrl,
        );
      }
    }
  }

  async onMTSScriptsLoaded(currentUrl: string, isLazy: boolean) {
    this.backgroundThread.markTiming('lepus_execute_start');
    const urlMap = templateManager.getBundle(currentUrl)
      ?.lepusCode as Record<string, string>;
    this.lepusCodeUrls.set(
      currentUrl,
      urlMap,
    );
    // External bundles register their mts chunks here (so `lynx.loadScript` can
    // load them on demand) but have no `root` chunk to auto-execute, so the
    // `urlMap['root']` guard skips the page render for them.
    if (!isLazy && urlMap && urlMap['root']) {
      await this.mtsRealm.loadScript(
        urlMap['root'],
      );
      this.onMTSScriptsExecuted();
    }
  }

  /**
   * Deliver an engine lifecycle event to the main-thread script with the
   * "listener wins, else direct call" fallback semantics. See
   * {@link dispatchEngineEventWithFallback}.
   */
  #dispatchEngineEvent(
    eventName: string,
    directCall: () => void,
    args: unknown[],
  ): void {
    dispatchEngineEventWithFallback(
      this.engineContext,
      eventName,
      directCall,
      args,
    );
  }

  onMTSScriptsExecuted() {
    this.backgroundThread.markTiming('lepus_execute_end');
    this.webElementsLoadingPromises.length = 0;
    this.backgroundThread.markTiming('data_processor_start');
    const processedData = this.#pageConfig?.['enableJSDataProcessor'] !== 'true'
        && this.mainThreadGlobalThis.processData
      ? this.mainThreadGlobalThis.processData?.(this.initData)
      : this.initData;
    this.backgroundThread.markTiming('data_processor_end');
    this.backgroundThread.startWebWorker(
      processedData,
      this.globalprops,
      templateManager.getBundle(this.templateUrl)!.config!.cardType,
      templateManager.getBundle(this.templateUrl)?.customSections as Record<
        string,
        Cloneable
      >,
      this.#nativeModulesMap,
      this.#napiModulesMap,
    );
    if (this.isSSR) {
      this.rootDom.querySelector('[part="page"]')?.remove();
    }
    this.#dispatchEngineEvent(
      EngineMessageEventType.RenderPage,
      () => this.mainThreadGlobalThis.renderPage?.(processedData),
      this.mtsRealm.globalWindow.Array.of(processedData),
    );
    this.mainThreadGlobalThis.__FlushElementTree();
  }

  async onBTSScriptsLoaded(url: string) {
    const btsUrls = templateManager.getBundle(url)
      ?.backgroundCode as Record<
        string,
        string
      >;
    await this.backgroundThread.updateBTSChunk(
      url,
      btsUrls,
    );
    // External and lazy bundles can finish before the entry manifest arrives.
    // Only the entry bundle may start its app-service module.
    if (url === this.templateUrl) {
      this.backgroundThread.startBTS();
    }
  }

  loadUnknownElement(tagName: string) {
    if (tagName.includes('-') && !customElements.get(tagName)) {
      this.rootDom.dispatchEvent(
        new CustomEvent(loadUnknownElementEventName, {
          detail: {
            tagName,
          },
        }),
      );
      this.webElementsLoadingPromises.push(
        customElements.whenDefined(tagName).then(() => {}),
      );
    }
  }

  queryComponent(url: string): Promise<unknown> {
    if (this.#bundleLoadCache.has(url)) {
      return this.#bundleLoadCache.get(url)!;
    }
    const promise = templateManager.fetchBundle(
      url,
      Promise.resolve(this),
      this.transformVW,
      this.transformVH,
      this.transformREM,
      {
        enableCSSSelector: this.#pageConfig!['enableCSSSelector'],
      },
    )
      .then(async () => {
        const urlMap = this.lepusCodeUrls.get(url);
        const rootUrl = urlMap?.['root'];
        if (!rootUrl) {
          throw new Error(`[lynx-web] Missing root URL for component: ${url}`);
        }
        let lepusRootChunkExport = await this.mtsRealm.loadScript(
          rootUrl,
        );
        lepusRootChunkExport = this.mainThreadGlobalThis.processEvalResult?.(
          lepusRootChunkExport,
          url,
        ) ?? lepusRootChunkExport;
        return lepusRootChunkExport;
      });
    this.#bundleLoadCache.set(url, promise);
    return promise;
  }

  /**
   * Fetch + decode + cache an external `.lynx.bundle` for `lynx.fetchBundle`.
   * Reuses the same machinery as {@link queryComponent} — the shared decode
   * worker, the bundle cache, and `onStyleInfoReady`, which applies the bundle's
   * pre-processed style section via the wasm style engine — but does not load a
   * lepus root chunk. Resolves to a response object (never rejects) so the
   * externals plugin can branch on `code`.
   */
  loadExternalBundle(url: string): Promise<ExternalBundleResponse> {
    if (this.#bundleLoadCache.has(url)) {
      return this.#bundleLoadCache.get(url)! as Promise<ExternalBundleResponse>;
    }
    const promise = templateManager.fetchBundle(
      url,
      Promise.resolve(this),
      this.transformVW,
      this.transformVH,
      this.transformREM,
      {
        enableCSSSelector: this.#pageConfig!['enableCSSSelector'],
        // An external bundle ships global styles (they apply to the consumer's
        // elements), so decode its StyleInfo unscoped rather than scoping it to
        // the bundle url the way a lazy component's styles are scoped.
        isLazy: 'false',
        // Mark the bundle external so the decode worker wraps its mts
        // (`lepusCode`) chunks with a CommonJS `module`/`exports` env.
        isExternalBundle: 'true',
      },
    ).then(
      () => ({ url, code: 0, errorMsg: '' }),
      (error) => ({
        url,
        code: -1,
        errorMsg: (error as Error)?.message ?? String(error),
      }),
    );
    this.#bundleLoadCache.set(url, promise);
    return promise;
  }

  async updateData(
    data: Cloneable,
    processorName?: string,
  ): Promise<void> {
    const targetGlobal = this.mtsRealm.globalWindow;
    const mtsData = cloneIntoRealm(data, targetGlobal);
    const processedData = this.#pageConfig!['enableJSDataProcessor'] !== 'true'
        && this.mainThreadGlobalThis.processData
      ? this.mainThreadGlobalThis.processData(mtsData, processorName)
      : mtsData;
    const options = Object.defineProperty(
      new targetGlobal.Object(),
      'processorName',
      {
        value: processorName,
        configurable: true,
        enumerable: true,
        writable: true,
      },
    );
    this.#dispatchEngineEvent(
      EngineMessageEventType.UpdatePage,
      () => this.mainThreadGlobalThis.updatePage?.(processedData, options),
      targetGlobal.Array.of(processedData, options),
    );
    await this.backgroundThread.updateData(processedData, { processorName });
  }

  async updateGlobalProps(data: Cloneable) {
    const targetGlobal = this.mtsRealm.globalWindow;
    const mtsData = cloneIntoRealm(data, targetGlobal);
    this.globalprops = mtsData;
    this.mainThreadGlobalThis.__globalProps = mtsData;
    if (this.mainThreadGlobalThis.lynx) {
      this.mainThreadGlobalThis.lynx.__globalProps = mtsData;
    }

    try {
      // Startup already sends the latest props. After startup, send before
      // calling MTS so a reentrant update follows the current one.
      if (this.backgroundThread.isWorkerStarted) {
        this.backgroundThread.updateGlobalProps(data);
      }
    } finally {
      // A failed send still leaves the MTS view with the latest props.
      this.#dispatchEngineEvent(
        EngineMessageEventType.UpdateGlobalProps,
        () => {
          try {
            this.mainThreadGlobalThis.updateGlobalProps?.(mtsData);
          } catch (error) {
            console.error(
              '[lynx-web] error in globalThis.updateGlobalProps',
              error,
            );
          }
        },
        targetGlobal.Array.of(mtsData),
      );
    }
  }

  reportError(error: Error, release: string, fileName: string) {
    this.rootDom.dispatchEvent(
      new CustomEvent('error', {
        detail: {
          sourceMap: {
            offset: {
              line: 2,
              col: 0,
            },
          },
          error,
          release,
          fileName,
        },
        bubbles: true,
        cancelable: true,
        composed: true,
      }),
    );
  }

  async [Symbol.asyncDispose]() {
    // Give the card a chance to clean up (remove element listeners, notify the
    // background thread) while the element tree and wasmContext are still
    // alive. Mirrors the `__DestroyLifetime` dispatch in
    // `LynxShell::Destroy` / `BTSRuntime`, which likewise fires before the
    // engine is torn down. `dispatchEvent` runs listeners synchronously, so
    // the card's cleanup has completed by the time this returns.
    try {
      // `data` is `undefined` rather than an empty array on purpose: unlike
      // `__RenderPage` / `__UpdatePage`, this event does not travel through the
      // engine's argument-packing path, so it carries no positional arguments.
      // Cards subscribe to it purely as a teardown signal.
      this.engineContext.dispatchEvent({
        type: EngineMessageEventType.DestroyLifetime,
        data: undefined,
      });
    } catch (e) {
      // A throwing card cleanup must not abort teardown of the rest of the
      // instance, otherwise we leak workers and DOM listeners.
      console.error('[lynx-web] error while dispatching __DestroyLifetime', e);
    }
    this.engineContext.dispose();
    this.boundingClientRectService.dispose();
    this.intersectionObserverService.dispose();
    await this.backgroundThread[Symbol.asyncDispose]();
    this.exposureServices.dispose();
    // Detach DOM event listeners synchronously. Some (keydown/keyup) are
    // bound on `document`, so deferring removal to the idle callback below
    // would leave stale handlers firing against a torn-down wasmContext.
    this.mtsWasmBinding.disposeEventListeners();
    requestIdleCallbackImpl(() => {
      this.mtsWasmBinding.dispose();
    });
  }
}
