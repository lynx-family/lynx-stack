/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TemplateSectionLabel } from '../../constants.js';
import type { LynxViewInstance } from './LynxViewInstance.js';
import type {
  MainMessage,
  LoadTemplateMessage,
  SectionMessage,
  InitMessage,
} from '../decodeWorker/types.js';
import type { PageConfig, DecodedTemplate } from '../../types/index.js';

const wasm = import(
  /* webpackMode: "eager" */
  /* webpackChunkName: "wasm-initializer" */
  /* webpackFetchPriority: "high" */
  /* webpackPrefetch: true */
  /* webpackPreload: true */
  '../wasm.js'
);

export class TemplateManager {
  readonly #templates: Map<string, DecodedTemplate> = new Map();
  readonly #lynxViewInstancesMap: Map<
    string,
    Promise<LynxViewInstance>
  > = new Map();
  readonly #pendingResolves: Map<
    string,
    { resolve: () => void; reject: (reason?: any) => void }
  > = new Map();

  #worker: Worker | null = null;
  #workerReadyPromise: Promise<void> | null = null;
  #resolveWorkerReady: (() => void) | null = null;

  constructor() {
    this.#ensureWorker();
  }

  public fetchBundle(
    url: string,
    lynxViewInstancePromise: Promise<LynxViewInstance>,
    overrideConfig?: Record<string, string>,
  ): Promise<void> {
    if (this.#templates.has(url) && !overrideConfig) {
      return (async () => {
        const template = this.#templates.get(url);
        const config = (template?.config || {}) as PageConfig;
        const lynxViewInstance = await lynxViewInstancePromise;
        lynxViewInstance.backgroundThread.markTiming('decode_start');
        lynxViewInstance.onPageConfigReady(config);
        lynxViewInstance.onStyleInfoReady(url);
        lynxViewInstance.onMTSScriptsLoaded(url, config.isLazy === 'true');
        lynxViewInstance.onBTSScriptsLoaded(url);
      })();
    } else {
      this.createTemplate(url);
      return this.#load(url, lynxViewInstancePromise, overrideConfig);
    }
  }

  async #load(
    url: string,
    lynxViewInstancePromise: Promise<LynxViewInstance>,
    overrideConfig?: Partial<PageConfig>,
  ): Promise<void> {
    const currentTime = performance.now() + performance.timeOrigin;
    lynxViewInstancePromise.then((instance) => {
      instance.backgroundThread.markTiming(
        'fetch_start',
        undefined,
        currentTime,
      );
    });
    this.#lynxViewInstancesMap.set(url, lynxViewInstancePromise);

    await this.#ensureWorker();

    const msg: LoadTemplateMessage = {
      type: 'load',
      url,
      fetchUrl: (new URL(url, location.href)).toString(),
      overrideConfig,
    };
    this.#worker!.postMessage(msg);
    return new Promise((resolve, reject) => {
      this.#pendingResolves.set(url, { resolve, reject });
    });
  }

  #resolvePromise(url: string) {
    const promise = this.#pendingResolves.get(url);
    if (promise) {
      promise.resolve();
      this.#pendingResolves.delete(url);
    }
  }

  #rejectPromise(url: string, reason?: any) {
    const promise = this.#pendingResolves.get(url);
    if (promise) {
      promise.reject(reason);
      this.#pendingResolves.delete(url);
    }
  }

  #ensureWorker(): Promise<void> | void {
    if (!this.#worker) {
      this.#workerReadyPromise = new Promise((resolve) => {
        this.#resolveWorkerReady = resolve;
      });
      this.#worker = new Worker(
        new URL(
          /* webpackFetchPriority: "high" */
          /* webpackChunkName: "web-core-template-loader-thread" */
          /* webpackPrefetch: true */
          /* webpackPreload: true */
          '../decodeWorker/decode.worker.js',
          import.meta.url,
        ),
        { type: 'module' },
      );
      this.#worker.onmessage = this.#handleMessage.bind(this);
      this.#workerReadyPromise.then(() => {
        wasm.then(({ wasmModule }) => {
          this.#worker!.postMessage({
            type: 'init',
            wasmModule,
          } as InitMessage);
        });
      });
      return this.#workerReadyPromise;
    } else if (this.#workerReadyPromise) {
      return this.#workerReadyPromise;
    }
  }

  #handleMessage(event: MessageEvent<MainMessage>) {
    const msg = event.data;
    if (msg.type === 'ready') {
      if (this.#resolveWorkerReady) {
        this.#resolveWorkerReady();
        this.#resolveWorkerReady = null;
        this.#workerReadyPromise = null;
      }
      return;
    }
    const { url } = msg;
    const lynxViewInstancePromise = this.#lynxViewInstancesMap.get(url);
    if (!lynxViewInstancePromise) return;

    switch (msg.type) {
      case 'section':
        /**
         * The lynxViewInstance is already awaited the wasm is ready
         */
        this.#handleSection(msg, lynxViewInstancePromise);
        break;
      case 'error':
        console.error(`Error decoding template ${url}:`, msg.error);
        this.#cleanup(url);
        this.#removeTemplate(url);
        this.#rejectPromise(url, new Error(msg.error));
        break;
      case 'done':
        this.#cleanup(url);
        /* TODO: The promise resolution is deferred inside .then() without error handling.
         *
         */
        lynxViewInstancePromise.then((instance) => {
          instance.backgroundThread.markTiming('decode_end');
          instance.backgroundThread.markTiming('load_template_start');
          this.#resolvePromise(url);
        });
        break;
    }
  }

  async #handleSection(
    msg: SectionMessage,
    instancePromise: Promise<LynxViewInstance>,
  ) {
    const [
      instance,
      StyleSheetResource,
    ] = await Promise.all([
      instancePromise,
      wasm.then((wasm) => (wasm.wasmInstance.StyleSheetResource)),
    ]);
    const { label, data, url, config } = msg;
    switch (label) {
      case TemplateSectionLabel.Configurations: {
        instance.backgroundThread.markTiming('decode_start');
        this.#setConfig(url, data);
        instance.onPageConfigReady(data);
        break;
      }
      case TemplateSectionLabel.StyleInfo: {
        const resource = new StyleSheetResource(
          new Uint8Array(data as ArrayBuffer),
          document,
        );
        const template = this.#templates.get(url);
        if (template) {
          template.styleSheet = resource;
        }
        instance.onStyleInfoReady(url);
        break;
      }
      case TemplateSectionLabel.LepusCode: {
        const blobMap = data as Record<string, string>;
        this.#setLepusCode(url, blobMap);
        instance.onMTSScriptsLoaded(url, config!['isLazy'] === 'true');
        break;
      }

      case TemplateSectionLabel.CustomSections: {
        this.#setCustomSection(url, data);
        break;
      }
      case TemplateSectionLabel.Manifest: {
        const blobMap = data as Record<string, string>;
        this.#setBackgroundCode(url, blobMap);
        instance.onBTSScriptsLoaded(url);
        break;
      }
      default:
        throw new Error(`Unknown section label: ${label}`);
    }
  }

  #cleanup(url: string) {
    this.#lynxViewInstancesMap.delete(url);
  }

  createTemplate(url: string) {
    if (this.#templates.has(url)) {
      // remove the template and revoke URLs
      const template = this.#templates.get(url);
      if (template) {
        if (template.lepusCode) {
          for (const blobUrl of Object.values(template.lepusCode)) {
            URL.revokeObjectURL(blobUrl);
          }
        }
        if (template.backgroundCode) {
          for (const blobUrl of Object.values(template.backgroundCode)) {
            URL.revokeObjectURL(blobUrl);
          }
        }
        if (template.styleSheet) {
          template.styleSheet.free();
        }
      }
      this.#templates.delete(url);
    }
    this.#templates.set(url, {});
  }

  #removeTemplate(url: string) {
    this.createTemplate(url); // This actually clears it in current logic
    this.#templates.delete(url);
  }

  #setConfig(url: string, config: PageConfig) {
    const template = this.#templates.get(url);
    if (template) {
      template.config = config;
    }
  }

  #setLepusCode(url: string, lepusCode: Record<string, string>) {
    const template = this.#templates.get(url);
    if (template) {
      template.lepusCode = lepusCode;
    }
  }

  #setCustomSection(url: string, customSections: Record<string, any>) {
    const template = this.#templates.get(url);
    if (template) {
      template.customSections = customSections;
    }
  }

  #setBackgroundCode(
    url: string,
    backgroundCode: Record<string, string>,
  ) {
    const template = this.#templates.get(url);
    if (template) {
      template.backgroundCode = backgroundCode;
    }
  }

  public getTemplate(url: string): DecodedTemplate | undefined {
    return this.#templates.get(url);
  }

  public getStyleSheet(url: string): any {
    return this.#templates.get(url)?.styleSheet;
  }
}

export const templateManager = new TemplateManager();
