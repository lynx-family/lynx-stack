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
} from '@types';
import { systemInfoBase } from '@constants';
import { BackgroundThread } from './Background.js';
import { I18nManager } from './I18n.js';
import { WASMJSBinding } from './elementAPIs/WASMJSBinding.js';
import { ExposureServices } from './ExposureServices.js';
import { createElementAPI } from './elementAPIs/createElementAPI.js';
import { createMainThreadGlobalAPIs } from './createMainThreadGlobalAPIs.js';
import { templateManager } from '../wasm.js';

const pixelRatio = window.devicePixelRatio;
const screenWidth = window.screen.availWidth * pixelRatio;
const screenHeight = window.screen.availHeight * pixelRatio;
export const systemInfo = Object.freeze({
  ...systemInfoBase,
  // some information only available on main thread, we should read and pass to worker
  pixelRatio,
  screenWidth,
  screenHeight,
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

  private renderPageFunction: ((data: Cloneable) => void) | null = null;

  lepusCodeUrls?: Record<string, string>;

  constructor(
    public readonly initData: Cloneable,
    public readonly globalprops: Cloneable,
    public readonly templateUrl: string,
    public readonly rootDom: ShadowRoot,
    public readonly mtsRealm: JSRealm,
    lynxGroupId: number | undefined,
    initI18nResources?: InitI18nResources,
  ) {
    this.mainThreadGlobalThis = mtsRealm.globalWindow as
      & typeof globalThis
      & MainThreadGlobalThis;

    this.backgroundThread = new BackgroundThread(lynxGroupId);
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
  }

  onPageConfigReady() {
    // create element APIs
    const enableCSSSelector = templateManager.getConfig(
      this.templateUrl,
      'enableCSSSelector',
    );
    const defaultDisplayLinear = templateManager.getConfig(
      this.templateUrl,
      'defaultDisplayLinear',
    );
    const defaultOverflowVisible = templateManager.getConfig(
      this.templateUrl,
      'defaultOverflowVisible',
    );
    Object.assign(
      this.mtsRealm.globalWindow,
      createElementAPI(
        this.templateUrl,
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
        return this.renderPageFunction;
      },
      set: (v) => {
        this.renderPageFunction = v;
        this.onMTSScriptsReady();
      },
      configurable: true,
      enumerable: true,
    });
  }

  onStyleInfoReady() {
    this.mtsWasmBinding.wasmContext?.__wasm_load_style(
      templateManager,
      this.templateUrl,
    );
  }

  onMTSScriptsLoaded(lepusCodeUrls: Record<string, string>) {
    this.lepusCodeUrls = lepusCodeUrls;
    this.mtsRealm.loadScript(this.lepusCodeUrls['root']!);
  }

  onMTSScriptsReady() {
    // start the webworker
    const processedData = this.mainThreadGlobalThis.processData
      ? this.mainThreadGlobalThis.processData(this.initData)
      : this.initData;
    this.mainThreadGlobalThis.renderPage?.(processedData);
    this.backgroundThread.startWebWorker();
  }

  onBTSScriptsLoaded() {
    // start executing in background thread
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
      }),
    );
  }

  async [Symbol.asyncDispose]() {
    await this.backgroundThread[Symbol.asyncDispose]();
  }
}
