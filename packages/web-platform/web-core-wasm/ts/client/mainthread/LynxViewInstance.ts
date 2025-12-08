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

  lepusCodeUrls?: Record<string, string>;

  constructor(
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
