/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import type {
  Cloneable,
  ExternalBundleResponse,
  FetchBundleOptions,
  InitI18nResources,
  InvokeUIMethodPAPI,
  JSRealm,
  MainThreadGlobalThis,
  NapiModulesMap,
  NativeModulesMap,
  PageConfig,
} from '../../types/index.js';
import {
  loadUnknownElementEventName,
  systemInfoBase,
} from '../../constants.js';
import { getExecutionSourceURL } from '../executionSourceURL.js';
import { BackgroundThread } from './Background.js';
import { BoundingClientRectService } from './BoundingClientRectService.js';
import { I18nManager } from './I18n.js';
import { WASMJSBinding } from './elementAPIs/WASMJSBinding.js';
import { createInvokeUIMethod } from './elementAPIs/createInvokeUIMethod.js';
import { ExposureServices } from './ExposureServices.js';
import { createElementAPI } from './elementAPIs/createElementAPI.js';
import { createMainThreadGlobalAPIs } from './createMainThreadGlobalAPIs.js';
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
  readonly i18nManager: I18nManager;
  readonly exposureServices: ExposureServices;
  readonly webElementsLoadingPromises: Promise<void>[] = [];

  #lazyBundleLoadCache = new Map<string, Promise<unknown>>();
  #externalBundleLoadCache = new Map<
    string,
    Promise<ExternalBundleResponse>
  >();
  #bundleDecodeQueue = new Map<string, Promise<void>>();
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

  constructor(
    public readonly parentDom: LynxViewElement,
    public readonly initData: Cloneable,
    public readonly globalprops: Cloneable,
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
    this.systemInfo = createSystemInfo(browserConfig);
    if (!isSSR) {
      this.rootDom.append(linkElement.cloneNode(false));
    }
    this.#nativeModulesMap = nativeModulesMap;
    this.#napiModulesMap = napiModulesMap;
    this.mainThreadGlobalThis = mtsRealm.globalWindow as
      & typeof globalThis
      & MainThreadGlobalThis;

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
        getExecutionSourceURL(currentUrl, 'root'),
      );
      this.onMTSScriptsExecuted();
    }
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
    this.mainThreadGlobalThis.renderPage?.(processedData);
    this.mainThreadGlobalThis.__FlushElementTree();
  }

  async onBTSScriptsLoaded(url: string, isExternalBundle = false) {
    const btsUrls = templateManager.getBundle(url)
      ?.backgroundCode as Record<
        string,
        string
      >;
    await this.backgroundThread.updateBTSChunk(
      url,
      btsUrls,
      isExternalBundle,
    );
    this.backgroundThread.startBTS();
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
    const cached = this.#lazyBundleLoadCache.get(url);
    if (cached) {
      return cached;
    }
    const promise = this.#decodeBundle(
      url,
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
          getExecutionSourceURL(url, 'root'),
        );
        lepusRootChunkExport = this.mainThreadGlobalThis.processEvalResult?.(
          lepusRootChunkExport,
          url,
        ) ?? lepusRootChunkExport;
        return lepusRootChunkExport;
      });
    const retryable = promise.catch(error => {
      if (this.#lazyBundleLoadCache.get(url) === retryable) {
        this.#lazyBundleLoadCache.delete(url);
      }
      throw error;
    });
    this.#lazyBundleLoadCache.set(url, retryable);
    return retryable;
  }

  /**
   * Fetch + decode + cache an external `.lynx.bundle` for `lynx.fetchBundle`.
   * Reuses the same machinery as {@link queryComponent} — the shared decode
   * worker and `onStyleInfoReady`, which applies the bundle's
   * pre-processed style section via the wasm style engine — but does not load a
   * lepus root chunk. Resolves to a response object (never rejects) so the
   * externals plugin can branch on `code`.
   */
  loadExternalBundle(
    url: string,
    options?: FetchBundleOptions,
  ): Promise<ExternalBundleResponse> {
    const isLazyBundle = options?.isLazyBundle === true;
    const cacheKey = `${isLazyBundle ? 'lazy' : 'external'}:${url}`;
    const cached = this.#externalBundleLoadCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const promise = this.#decodeBundle(
      url,
      {
        enableCSSSelector: this.#pageConfig!['enableCSSSelector'],
        // External containers ship global styles; lazy components retain their
        // URL scope and callable main-thread wrapper.
        isLazy: isLazyBundle ? 'true' : 'false',
        // Mark the bundle external so the decode worker wraps its mts
        // (`lepusCode`) chunks with a CommonJS `module`/`exports` env.
        isExternalBundle: isLazyBundle ? 'false' : 'true',
      },
    ).then(
      () => ({ url, code: 0, errorMsg: '' }),
      (error) => {
        this.#externalBundleLoadCache.delete(cacheKey);
        return {
          url,
          code: -1,
          errorMsg: (error as Error)?.message ?? String(error),
        };
      },
    );
    this.#externalBundleLoadCache.set(cacheKey, promise);
    return promise;
  }

  #decodeBundle(
    url: string,
    overrideConfig: Record<string, string>,
  ): Promise<void> {
    const previous = this.#bundleDecodeQueue.get(url);
    const promise = (previous?.catch(() => undefined) ?? Promise.resolve())
      .then(() =>
        templateManager.fetchBundle(
          url,
          Promise.resolve(this),
          this.transformVW,
          this.transformVH,
          this.transformREM,
          overrideConfig,
        )
      );
    this.#bundleDecodeQueue.set(url, promise);
    void promise.then(
      () => this.#removeBundleDecode(url, promise),
      () => this.#removeBundleDecode(url, promise),
    );
    return promise;
  }

  #removeBundleDecode(url: string, promise: Promise<void>): void {
    if (this.#bundleDecodeQueue.get(url) === promise) {
      this.#bundleDecodeQueue.delete(url);
    }
  }

  async updateData(
    data: Cloneable,
    processorName?: string,
  ): Promise<void> {
    const processedData = this.#pageConfig!['enableJSDataProcessor'] !== 'true'
        && this.mainThreadGlobalThis.processData
      ? this.mainThreadGlobalThis.processData(data, processorName)
      : data;
    this.mainThreadGlobalThis.updatePage?.(processedData, { processorName });
    await this.backgroundThread.updateData(processedData, { processorName });
  }

  async updateGlobalProps(data: Cloneable) {
    await this.backgroundThread.updateGlobalProps(data);
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
    this.boundingClientRectService.dispose();
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
