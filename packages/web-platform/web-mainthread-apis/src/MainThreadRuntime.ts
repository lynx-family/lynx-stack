// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  type ElementOperation,
  type LynxLifecycleEvent,
  type LynxTemplate,
  type PageConfig,
  type ProcessDataCallback,
  type StyleInfo,
  type FlushElementTreeOptions,
  type Cloneable,
  type CssInJsInfo,
  type BrowserConfig,
} from '@lynx-js/web-constants';
import { globalMuteableVars } from '@lynx-js/web-constants';
import { createMainThreadLynx, type MainThreadLynx } from './MainThreadLynx.js';
import { initializeElementCreatingFunction } from './elementAPI/elementCreating/elementCreatingFunctions.js';
import * as attributeAndPropertyApis from './elementAPI/attributeAndProperty/attributeAndPropertyFunctions.js';
import * as domTreeApis from './elementAPI/domTree/domTreeFunctions.js';
import * as eventApis from './elementAPI/event/eventFunctions.js';
import * as styleApis from './elementAPI/style/styleFunctions.js';
import {
  flattenStyleInfo,
  genCssContent,
  genCssInJsInfo,
  transformToWebCss,
} from './utils/processStyleInfo.js';

export interface MainThreadRuntimeCallbacks {
  mainChunkReady: () => void;
  flushElementTree: (
    operations: ElementOperation[],
    options: FlushElementTreeOptions,
    styleContent?: string,
  ) => void;
  _ReportError: (error: Error, info?: unknown) => void;
  __OnLifecycleEvent: (lynxLifecycleEvents: LynxLifecycleEvent) => void;
  markTiming: (pipelineId: string, timingKey: string) => void;
}

export interface MainThreadConfig {
  pageConfig: PageConfig;
  globalProps: unknown;
  callbacks: MainThreadRuntimeCallbacks;
  styleInfo: StyleInfo;
  customSections: LynxTemplate['customSections'];
  lepusCode: LynxTemplate['lepusCode'];
  entryId: string;
  browserConfig: BrowserConfig;
}

export class MainThreadRuntime {
  private isFp = true;

  public operationsRef: {
    operations: ElementOperation[];
  } = {
    operations: [],
  };
  constructor(
    private config: MainThreadConfig,
  ) {
    this.__globalProps = config.globalProps;
    this.lynx = createMainThreadLynx(config, this);
    flattenStyleInfo(this.config.styleInfo);
    transformToWebCss(this.config.styleInfo);
    const cssInJs: CssInJsInfo = this.config.pageConfig.enableCSSSelector
      ? {}
      : genCssInJsInfo(this.config.styleInfo);
    Object.assign(
      this,
      attributeAndPropertyApis,
      domTreeApis,
      eventApis,
      styleApis,
      initializeElementCreatingFunction({
        operationsRef: this.operationsRef,
        pageConfig: config.pageConfig,
        styleInfo: cssInJs,
      }),
    );
    this.__LoadLepusChunk = (path) => {
      try {
        this.lynx.requireModule(path);
        return true;
      } catch {
      }
      return false;
    };
    this._ReportError = this.config.callbacks._ReportError;
    this.__OnLifecycleEvent = this.config.callbacks.__OnLifecycleEvent;
    Object.defineProperty(this, 'renderPage', {
      get: () => {
        return this.#renderPage;
      },
      set: (val: (data: unknown) => void) => {
        this.#renderPage = val;
        queueMicrotask(this.config.callbacks.mainChunkReady);
      },
    });
    for (const nm of globalMuteableVars) {
      Object.defineProperty(this, nm, {
        get: () => {
          return this.__lynxGlobalBindingValues[nm];
        },
        set: (v: any) => {
          this.__lynxGlobalBindingValues[nm] = v;
          this._updateVars?.();
        },
      });
    }
  }

  /**
   * @private
   */
  __lynxGlobalBindingValues: Record<string, any> = {};

  get globalThis() {
    return this;
  }

  lynx: MainThreadLynx;

  NativeModules = undefined;

  __globalProps: unknown;

  processData?: ProcessDataCallback;

  #renderPage?: (data: unknown) => void;

  declare renderPage: (data: unknown) => void;

  _ReportError: (e: Error, info: unknown) => void;

  __OnLifecycleEvent: (lynxLifecycleEvents: LynxLifecycleEvent) => void;

  __LoadLepusChunk: (path: string) => boolean;

  __FlushElementTree = (
    _subTree: unknown,
    options: FlushElementTreeOptions,
  ) => {
    const operations = this.operationsRef.operations;
    this.operationsRef.operations = [];
    this.config.callbacks.flushElementTree(
      operations,
      options,
      this.isFp
        ? genCssContent(
          this.config.styleInfo,
          this.config.entryId,
          this.config.pageConfig,
          this.config.browserConfig,
        )
        : undefined,
    );
    this.isFp = false;
  };

  updatePage?: (data: Cloneable, options?: Record<string, string>) => void;

  _updateVars?: () => void;
}
