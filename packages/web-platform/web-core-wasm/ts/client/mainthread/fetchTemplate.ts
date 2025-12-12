/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TemplateSectionLabel } from '../../constants.js';
import { templateManager } from '../wasm.js';
import type { LynxViewInstance } from './LynxViewInstance.js';
import type {
  MainMessage,
  LoadTemplateMessage,
  SectionMessage,
} from '../decodeWorker/types.js';

class DecodeWorkerManager {
  private worker: Worker | null = null;
  private activeUrls: Set<string> = new Set();
  private terminateTimer: ReturnType<typeof setTimeout> | null = null;
  private lynxViewInstances: Map<
    string,
    { instance: LynxViewInstance; executeRoot: boolean }
  > = new Map();
  private pendingResolves: Map<
    string,
    { resolve: () => void; reject: (reason?: any) => void }
  > = new Map();

  public load(
    url: string,
    instance: LynxViewInstance,
    executeRoot: boolean,
  ): Promise<void> {
    this.ensureWorker();
    this.activeUrls.add(url);
    this.lynxViewInstances.set(url, { instance, executeRoot });
    if (this.terminateTimer) {
      clearTimeout(this.terminateTimer);
      this.terminateTimer = null;
    }

    const msg: LoadTemplateMessage = {
      type: 'load',
      url,
      fetchUrl: new URL(url, document.baseURI).href,
    };
    this.worker!.postMessage(msg);
    return new Promise((resolve, reject) => {
      this.pendingResolves.set(url, { resolve, reject });
    });
  }

  private resolvePromise(url: string) {
    const promise = this.pendingResolves.get(url);
    if (promise) {
      promise.resolve();
      this.pendingResolves.delete(url);
    }
  }

  private rejectPromise(url: string, reason?: any) {
    const promise = this.pendingResolves.get(url);
    if (promise) {
      promise.reject(reason);
      this.pendingResolves.delete(url);
    }
  }

  private ensureWorker() {
    if (!this.worker) {
      this.worker = new Worker(
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
      this.worker.onmessage = this.handleMessage.bind(this);
    }
  }

  private handleMessage(event: MessageEvent<MainMessage>) {
    const msg = event.data;
    const { url } = msg;
    const context = this.lynxViewInstances.get(url);
    if (!context) return;

    const { instance, executeRoot } = context;

    switch (msg.type) {
      case 'section':
        this.handleSection(msg, instance, executeRoot);
        break;
      case 'error':
        console.error(`Error decoding template ${url}:`, msg.error);
        this.cleanup(url);
        templateManager.removeTemplate(url);
        this.rejectPromise(url, new Error(msg.error));
        break;
      case 'done':
        this.cleanup(url);
        this.resolvePromise(url);
        break;
    }
  }

  private handleSection(
    msg: SectionMessage,
    instance: LynxViewInstance,
    executeRoot: boolean,
  ) {
    const { label, data, url, config } = msg;
    switch (label) {
      case TemplateSectionLabel.Configurations: {
        templateManager.setConfig(url, data);
        instance.onPageConfigReady(data);
        break;
      }
      case TemplateSectionLabel.StyleInfo: {
        templateManager.setStyleInfo(
          url,
          data,
          config!['enableCSSSelector'] === 'true',
          config!['isLazy'] === 'true',
        );
        instance.onStyleInfoReady(url);
        break;
      }
      case TemplateSectionLabel.LepusCode: {
        const blobMap = data as Record<string, string>;
        // @ts-ignore
        templateManager.setLepusCode(url, blobMap);
        break;
      }
      case TemplateSectionLabel.ElementTemplates:
        templateManager.setElementTemplateSection(url, data);
        break;
      case TemplateSectionLabel.CustomSections: {
        templateManager.setCustomSection(url, data);
        instance.onMTSScriptsLoaded(url, executeRoot);
        break;
      }
      case TemplateSectionLabel.Manifest: {
        const blobMap = data as Record<string, string>;
        // @ts-ignore
        templateManager.setBackgroundCode(url, blobMap);
        instance.onBTSScriptsLoaded(url);
        this.resolvePromise(url);
        break;
      }
      default:
        throw new Error(`Unknown section label: ${label}`);
    }
  }

  private cleanup(url: string) {
    this.activeUrls.delete(url);
    this.lynxViewInstances.delete(url);
    if (this.activeUrls.size === 0) {
      this.terminateTimer = setTimeout(() => {
        if (this.activeUrls.size === 0 && this.worker) {
          this.worker.terminate();
          this.worker = null;
        }
      }, 10000);
    }
  }
}

const workerManager = new DecodeWorkerManager();

const fetchedTemplates = new Set<string>();

export function fetchTemplate(
  url: string,
  lynxViewInstance: LynxViewInstance,
  executeRoot: boolean,
): Promise<void> {
  if (fetchedTemplates.has(url)) {
    return new Promise((resolve) => {
      const config = templateManager.getConfig(url);
      lynxViewInstance.onPageConfigReady(config);
      lynxViewInstance.onStyleInfoReady(url);
      lynxViewInstance.onMTSScriptsLoaded(url, executeRoot);
      lynxViewInstance.onBTSScriptsLoaded(url);
      resolve();
    });
  } else {
    templateManager.createTemplate(url);
    return workerManager.load(url, lynxViewInstance, executeRoot);
  }
}
