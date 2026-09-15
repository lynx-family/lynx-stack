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
  readonly #bundles: Map<string, DecodedTemplate> = new Map();
  readonly #loadingBundles: Map<string, DecodedTemplate> = new Map();
  readonly #loadingPromises: Map<string, Promise<DecodedTemplate>> = new Map();
  readonly #sectionQueues: Map<string, Promise<void>> = new Map();
  readonly #lynxViewInstancesMap: Map<
    string,
    Promise<LynxViewInstance>
  > = new Map();
  readonly #pendingResolves: Map<
    string,
    {
      resolve: (bundle: DecodedTemplate) => void;
      reject: (reason?: any) => void;
    }
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
    transformVW: boolean,
    transformVH: boolean,
    transformREM: boolean,
    overrideConfig?: Record<string, string>,
  ): Promise<DecodedTemplate> {
    const key = !transformVW && !transformVH && !transformREM
        && !Object.keys(overrideConfig ?? {}).length
      ? url
      : JSON.stringify([
        url,
        transformVW,
        transformVH,
        transformREM,
        Object.entries(overrideConfig ?? {}).sort(([a], [b]) =>
          a.localeCompare(b)
        ),
      ]);
    if (this.#bundles.has(key)) {
      return (async () => {
        const bundle = this.#bundles.get(key)!;
        const config = (bundle?.config || {}) as PageConfig;
        const lynxViewInstance = await lynxViewInstancePromise;
        if (lynxViewInstance.templateUrl === url) {
          lynxViewInstance.template = bundle;
        }
        lynxViewInstance.backgroundThread.markTiming('decode_start');
        lynxViewInstance.onPageConfigReady(config);
        lynxViewInstance.onStyleInfoReady(url, bundle);
        await lynxViewInstance.onMTSScriptsLoaded(
          url,
          config.isLazy === 'true',
          bundle,
        );
        await lynxViewInstance.onBTSScriptsLoaded(
          url,
          config.isExternalBundle === 'true',
          bundle,
        );
        return bundle;
      })();
    } else if (this.#loadingPromises.has(key)) {
      return this.#loadingPromises.get(key)!.then(async bundle => {
        const config = (bundle?.config || {}) as PageConfig;
        const lynxViewInstance = await lynxViewInstancePromise;
        if (lynxViewInstance.templateUrl === url) {
          lynxViewInstance.template = bundle;
        }
        lynxViewInstance.backgroundThread.markTiming('decode_start');
        lynxViewInstance.onPageConfigReady(config);
        lynxViewInstance.onStyleInfoReady(url, bundle);
        await lynxViewInstance.onMTSScriptsLoaded(
          url,
          config.isLazy === 'true',
          bundle,
        );
        await lynxViewInstance.onBTSScriptsLoaded(
          url,
          config.isExternalBundle === 'true',
          bundle,
        );
        return bundle;
      });
    } else {
      this.createBundle(key);
      const promise = this.#load(
        url,
        lynxViewInstancePromise,
        transformVW,
        transformVH,
        transformREM,
        overrideConfig,
        key,
      );
      this.#loadingPromises.set(key, promise);
      return promise;
    }
  }

  async #load(
    url: string,
    lynxViewInstancePromise: Promise<LynxViewInstance>,
    transformVW: boolean,
    transformVH: boolean,
    transformREM: boolean,
    overrideConfig?: Partial<PageConfig>,
    key = url,
  ): Promise<DecodedTemplate> {
    const currentTime = performance.now() + performance.timeOrigin;
    lynxViewInstancePromise.then((instance) => {
      instance.backgroundThread.markTiming(
        'fetch_start',
        undefined,
        currentTime,
      );
    });
    this.#lynxViewInstancesMap.set(key, lynxViewInstancePromise);

    await this.#ensureWorker();

    const msg: LoadTemplateMessage = {
      type: 'load',
      url,
      fetchUrl: (new URL(url, location.href)).toString(),
      transformVW,
      transformVH,
      transformREM,
      overrideConfig,
      decodeKey: key,
    };
    this.#worker!.postMessage(msg);
    return new Promise<DecodedTemplate>((resolve, reject) => {
      this.#pendingResolves.set(key, { resolve, reject });
    });
  }

  #resolvePromise(url: string) {
    const promise = this.#pendingResolves.get(url);
    if (promise) {
      promise.resolve(this.#bundles.get(url)!);
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
    if (msg.type === 'heartbreak') {
      this.#worker?.postMessage({ type: 'heartbreak' });
      return;
    }
    const { url } = msg;
    const key = msg.decodeKey ?? url;
    const lynxViewInstancePromise = this.#lynxViewInstancesMap.get(key);
    if (!lynxViewInstancePromise) return;

    switch (msg.type) {
      case 'section':
        /**
         * The lynxViewInstance is already awaited the wasm is ready
         */
        this.#queueSection(msg, lynxViewInstancePromise, key);
        break;
      case 'error':
        console.error(`Error decoding bundle ${url}:`, msg.error);
        this.#cleanup(key);
        this.#removeBundle(key);
        this.#rejectPromise(key, new Error(msg.error));
        this.#loadingPromises.delete(key);
        this.#sectionQueues.delete(key);
        break;
      case 'done':
        void this.#completeBundle(url, lynxViewInstancePromise, key);
        break;
    }
  }

  #queueSection(
    msg: SectionMessage,
    instancePromise: Promise<LynxViewInstance>,
    key: string,
  ) {
    const previous = this.#sectionQueues.get(key) ?? Promise.resolve();
    const queued = previous.then(() =>
      this.#handleSection(msg, instancePromise, key)
    );
    this.#sectionQueues.set(key, queued);
    void queued.catch(() => {});
  }

  async #completeBundle(
    url: string,
    lynxViewInstancePromise: Promise<LynxViewInstance>,
    key: string,
  ) {
    try {
      await this.#sectionQueues.get(key);
      const bundle = this.#loadingBundles.get(key);
      const instance = await lynxViewInstancePromise;
      instance.backgroundThread.markTiming('decode_end');
      instance.backgroundThread.markTiming('load_template_start');
      if (bundle) {
        // LepusCode may precede StyleInfo in the stream. Register all sections
        // before executing scripts so the first render can query its styles.
        if (bundle.lepusCode) {
          await instance.onMTSScriptsLoaded(
            url,
            bundle.config?.isLazy === 'true',
            bundle,
          );
        }
        if (bundle.backgroundCode) {
          await instance.onBTSScriptsLoaded(
            url,
            bundle.config?.isExternalBundle === 'true',
            bundle,
          );
        }
        this.#bundles.set(key, bundle);
        this.#loadingBundles.delete(key);
      }
      this.#resolvePromise(key);
    } catch (error) {
      this.#removeBundle(key);
      this.#rejectPromise(key, error);
    } finally {
      this.#cleanup(key);
      this.#loadingPromises.delete(key);
      this.#sectionQueues.delete(key);
    }
  }

  async #handleSection(
    msg: SectionMessage,
    instancePromise: Promise<LynxViewInstance>,
    key: string,
  ) {
    const [
      instance,
      StyleSheetResource,
    ] = await Promise.all([
      instancePromise,
      wasm.then((wasm) => (wasm.wasmInstance.StyleSheetResource)),
    ]);
    const { label, data, url } = msg;
    switch (label) {
      case TemplateSectionLabel.Configurations: {
        instance.backgroundThread.markTiming('decode_start');
        this.#setConfig(key, data);
        if (instance.templateUrl === url) {
          instance.template = this.#loadingBundles.get(key);
        }
        instance.onPageConfigReady(data);
        break;
      }
      case TemplateSectionLabel.StyleInfo: {
        const resource = new StyleSheetResource(
          new Uint8Array(data as ArrayBuffer),
          document,
        );
        const bundle = this.#loadingBundles.get(key);
        if (bundle) {
          bundle.styleSheet = resource;
        }
        instance.onStyleInfoReady(url, bundle!);
        break;
      }
      case TemplateSectionLabel.LepusCode: {
        const blobMap = data as Record<string, string>;
        this.#setLepusCode(key, blobMap);
        break;
      }

      case TemplateSectionLabel.CustomSections: {
        this.#setCustomSection(key, data);
        break;
      }
      case TemplateSectionLabel.Manifest: {
        const blobMap = data as Record<string, string>;
        this.#setBackgroundCode(key, blobMap);
        break;
      }
      default:
        throw new Error(`Unknown section label: ${label}`);
    }
  }

  #cleanup(url: string) {
    this.#lynxViewInstancesMap.delete(url);
  }

  createBundle(url: string) {
    if (this.#bundles.has(url)) {
      const bundle = this.#bundles.get(url);
      if (bundle) {
        if (bundle.lepusCode) {
          for (const blobUrl of Object.values(bundle.lepusCode)) {
            URL.revokeObjectURL(blobUrl);
          }
        }
        if (bundle.backgroundCode) {
          for (const blobUrl of Object.values(bundle.backgroundCode)) {
            URL.revokeObjectURL(blobUrl);
          }
        }
        if (bundle.styleSheet) {
          bundle.styleSheet.free();
        }
      }
      this.#bundles.delete(url);
    }
    if (this.#loadingBundles.has(url)) {
      const bundle = this.#loadingBundles.get(url);
      if (bundle) {
        if (bundle.lepusCode) {
          for (const blobUrl of Object.values(bundle.lepusCode)) {
            URL.revokeObjectURL(blobUrl);
          }
        }
        if (bundle.backgroundCode) {
          for (const blobUrl of Object.values(bundle.backgroundCode)) {
            URL.revokeObjectURL(blobUrl);
          }
        }
        if (bundle.styleSheet) {
          bundle.styleSheet.free();
        }
      }
      this.#loadingBundles.delete(url);
    }
    this.#loadingBundles.set(url, {});
  }

  #removeBundle(url: string) {
    this.createBundle(url); // This actually clears it in current logic
    this.#loadingBundles.delete(url);
  }

  #setConfig(url: string, config: PageConfig) {
    const bundle = this.#loadingBundles.get(url);
    if (bundle) {
      bundle.config = config;
    }
  }

  #setLepusCode(url: string, lepusCode: Record<string, string>) {
    const bundle = this.#loadingBundles.get(url);
    if (bundle) {
      bundle.lepusCode = lepusCode;
    }
  }

  #setCustomSection(url: string, customSections: Record<string, any>) {
    const bundle = this.#loadingBundles.get(url);
    if (bundle) {
      bundle.customSections = customSections;
    }
  }

  #setBackgroundCode(
    url: string,
    backgroundCode: Record<string, string>,
  ) {
    const bundle = this.#loadingBundles.get(url);
    if (bundle) {
      bundle.backgroundCode = backgroundCode;
    }
  }

  public getBundle(url: string): DecodedTemplate | undefined {
    return this.#bundles.get(url) || this.#loadingBundles.get(url);
  }

  public getStyleSheet(url: string): any {
    return this.getBundle(url)?.styleSheet;
  }
}

export const templateManager = new TemplateManager();
