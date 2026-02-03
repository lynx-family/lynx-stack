/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import type {
  Cloneable,
  InitI18nResources,
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
import { BackgroundThread } from './Background.js';
import { I18nManager } from './I18n.js';
import { WASMJSBinding } from './elementAPIs/WASMJSBinding.js';
import { ExposureServices } from './ExposureServices.js';
import { createElementAPI } from './elementAPIs/createElementAPI.js';
import { createMainThreadGlobalAPIs } from './createMainThreadGlobalAPIs.js';
import { templateManager } from './TemplateManager.js';
import { loadAllWebElements } from '../webElementsDynamicLoader.js';
import type { LynxViewElement } from './LynxView.js';
const loadAllWebElementsPromise = loadAllWebElements();

const pixelRatio = window.devicePixelRatio;
const screenWidth = window.screen.availWidth * pixelRatio;
const screenHeight = window.screen.availHeight * pixelRatio;
export const systemInfo = Object.freeze({
  ...systemInfoBase,
  // some information only available on main thread, we should read and pass to worker
  pixelRatio,
  pixelWidth: screenWidth,
  pixelHeight: screenHeight,
});

export interface LynxViewConfigs {
  templateUrl: string;
  initData: Cloneable;
  globalProps: Cloneable;
  shadowRoot: ShadowRoot;
  nativeModulesMap: NativeModulesMap;
  napiModulesMap: NapiModulesMap;
  tagMap: Record<string, string>;
  lynxGroupId: number | undefined;
  initI18nResources: InitI18nResources;
}

export class LynxViewInstance implements AsyncDisposable {
  readonly mainThreadGlobalThis: MainThreadGlobalThis;
  readonly mtsWasmBinding: WASMJSBinding;
  readonly backgroundThread: BackgroundThread;
  readonly i18nManager: I18nManager;
  readonly exposureServices: ExposureServices;
  readonly webElementsLoadingPromises: Promise<void>[] = [];

  #renderPageFunction: ((data: Cloneable) => void) | null = null;
  #queryComponentCache: Map<string, Promise<unknown>> = new Map();
  #pageConfig?: PageConfig;
  #nativeModulesMap: NativeModulesMap;
  #napiModulesMap: NapiModulesMap;

  lepusCodeUrls = new Map<string, Record<string, string>>();

  constructor(
    public readonly parentDom: LynxViewElement,
    public readonly initData: Cloneable,
    public readonly globalprops: Cloneable,
    public readonly templateUrl: string,
    public readonly rootDom: ShadowRoot,
    public readonly mtsRealm: JSRealm,
    lynxGroupId: number | undefined,
    nativeModulesMap: NativeModulesMap = {},
    napiModulesMap: NapiModulesMap = {},
    initI18nResources?: InitI18nResources,
  ) {
    this.#nativeModulesMap = nativeModulesMap;
    this.#napiModulesMap = napiModulesMap;
    this.parentDom.style.display = 'none';
    this.mainThreadGlobalThis = mtsRealm.globalWindow as
      & typeof globalThis
      & MainThreadGlobalThis;

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
      ),
      createMainThreadGlobalAPIs(
        this,
      ),
    );
    Object.defineProperty(this.mainThreadGlobalThis, 'renderPage', {
      get: () => {
        return this.#renderPageFunction;
      },
      set: (v) => {
        this.#renderPageFunction = v;
        this.onMTSScriptsExecuted();
      },
      configurable: true,
      enumerable: true,
    });
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
    loadAllWebElementsPromise.then(() => {
      this.parentDom.style.display = 'flex';
    });
  }

  onMTSScriptsLoaded(currentUrl: string, isLazy: boolean) {
    this.backgroundThread.markTiming('lepus_execute_start');
    const urlMap = templateManager.getTemplate(currentUrl)
      ?.lepusCode as Record<string, string>;
    this.lepusCodeUrls.set(
      currentUrl,
      urlMap,
    );
    if (!isLazy) {
      this.mtsRealm.loadScript(
        urlMap['root']!,
      );
    }
  }

  async onMTSScriptsExecuted() {
    this.backgroundThread.markTiming('lepus_execute_end');
    this.webElementsLoadingPromises.length = 0;
    this.backgroundThread.markTiming('data_processor_start');
    const processedData = this.mainThreadGlobalThis.processData
      ? this.mainThreadGlobalThis.processData?.(this.initData)
      : this.initData;
    this.backgroundThread.markTiming('data_processor_end');
    this.backgroundThread.startWebWorker(
      processedData,
      this.globalprops,
      templateManager.getTemplate(this.templateUrl)!.config!.cardType,
      templateManager.getTemplate(this.templateUrl)?.customSections as Record<
        string,
        Cloneable
      >,
      this.#nativeModulesMap,
      this.#napiModulesMap,
    );
    this.#renderPageFunction?.(processedData);
    this.mainThreadGlobalThis.__FlushElementTree();
  }

  async onBTSScriptsLoaded(url: string) {
    const btsUrls = templateManager.getTemplate(url)
      ?.backgroundCode as Record<
        string,
        string
      >;
    await this.backgroundThread.updateBTSChunk(
      url,
      btsUrls,
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
    if (this.#queryComponentCache.has(url)) {
      return this.#queryComponentCache.get(url)!;
    }
    const promise = templateManager.fetchBundle(url, Promise.resolve(this), {
      enableCSSSelector: this.#pageConfig!['enableCSSSelector'],
    })
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
        );
        return lepusRootChunkExport;
      });
    this.#queryComponentCache.set(url, promise);
    return promise;
  }

  async updateData(
    data: Cloneable,
    processorName?: string,
  ): Promise<void> {
    const processedData = this.mainThreadGlobalThis.processData
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
    await this.backgroundThread[Symbol.asyncDispose]();
  }
}
