// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  type StartMainThreadContextConfig,
  type RpcCallType,
  type updateDataEndpoint,
  type MainThreadGlobalThis,
  type I18nResourceTranslationOptions,
  type CloneableObject,
  i18nResourceMissedEventName,
  I18nResources,
  type InitI18nResources,
  type Cloneable,
  lynxUniqueIdAttribute,
  type SSRDumpInfo,
  type JSRealm,
  type TemplateLoader,
} from '@lynx-js/web-constants';
import { Rpc } from '@lynx-js/web-worker-rpc';
import { dispatchLynxViewEvent } from '../utils/dispatchLynxViewEvent.js';
import { createExposureMonitor } from './crossThreadHandlers/createExposureMonitor.js';
import type { StartUIThreadCallbacks } from './startUIThread.js';

const {
  prepareMainThreadAPIs,
} = await import(
  /* webpackChunkName: "web-core-main-thread-apis" */
  /* webpackMode: "lazy-once" */
  /* webpackPreload: true */
  /* webpackPrefetch: true */
  /* webpackFetchPriority: "high" */
  '@lynx-js/web-mainthread-apis'
);

/**
 * Creates a isolated JavaScript context for executing mts code.
 * This context has its own global variables and functions.
 */
function createIFrameRealm(parent: Node): JSRealm {
  const iframe = document.createElement('iframe');
  const iframeLoaded = new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
  });
  iframe.style.display = 'none';
  iframe.src = 'about:blank';
  parent.appendChild(iframe);
  const iframeWindow = iframe.contentWindow! as unknown as typeof globalThis;
  const iframeDocument = iframe.contentDocument!;
  const loadScript: (url: string) => Promise<unknown> = (url) => {
    return new Promise(async (resolve, reject) => {
      if (iframeDocument.readyState !== 'complete') {
        await iframeLoaded;
      }
      const script = iframeDocument.createElement('script');
      script.src = url;
      script.fetchPriority = 'high';
      script.defer = true;
      script.async = false;
      script.onload = () => {
        const ret = iframeWindow?.module?.exports;
        // @ts-expect-error
        iframeWindow.module = { exports: undefined };
        resolve(ret);
      };
      script.onerror = (err) =>
        reject(new Error(`Failed to load script: ${url}`, { cause: err }));
      // @ts-expect-error
      iframeWindow.module = { exports: undefined };
      iframe.contentDocument!.head.appendChild(script);
    });
  };
  const loadScriptSync: (url: string) => unknown = (url) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false); // Synchronous request
    xhr.send(null);
    if (xhr.status === 200) {
      const script = iframe.contentDocument!.createElement('script');
      script.textContent = xhr.responseText;
      // @ts-expect-error
      iframeWindow.module = { exports: undefined };
      iframe.contentDocument!.head.appendChild(script);
      const ret = iframeWindow?.module?.exports;
      // @ts-expect-error
      iframeWindow.module = { exports: undefined };
      return ret;
    } else {
      throw new Error(`Failed to load script: ${url}`, { cause: xhr });
    }
  };
  return { globalWindow: iframeWindow, loadScript, loadScriptSync };
}

export function createRenderAllOnUI(
  mainToBackgroundRpc: Rpc,
  shadowRoot: ShadowRoot,
  loadTemplate: TemplateLoader,
  markTimingInternal: (
    timingKey: string,
    pipelineId?: string,
    timeStamp?: number,
  ) => void,
  flushMarkTimingInternal: () => void,
  callbacks: StartUIThreadCallbacks,
  ssrDumpInfo: SSRDumpInfo | undefined,
) {
  if (!globalThis.module) {
    Object.assign(globalThis, { module: {} });
  }
  const triggerI18nResourceFallback = (
    options: I18nResourceTranslationOptions,
  ) => {
    dispatchLynxViewEvent(
      shadowRoot,
      i18nResourceMissedEventName,
      options as CloneableObject,
    );
  };
  const i18nResources = new I18nResources();
  const { exposureChangedCallback } = createExposureMonitor(shadowRoot);
  const mtsRealm = createIFrameRealm(shadowRoot);
  const mtsGlobalThis = mtsRealm.globalWindow as
    & typeof globalThis
    & MainThreadGlobalThis;
  const { startMainThread } = prepareMainThreadAPIs(
    mainToBackgroundRpc,
    shadowRoot,
    document,
    mtsRealm,
    exposureChangedCallback,
    markTimingInternal,
    flushMarkTimingInternal,
    (err, _, release) => {
      callbacks.onError?.(err, release, 'lepus.js');
    },
    triggerI18nResourceFallback,
    (initI18nResources: InitI18nResources) => {
      i18nResources.setData(initI18nResources);
      return i18nResources;
    },
    loadTemplate,
  );
  const pendingUpdateCalls: Parameters<
    RpcCallType<typeof updateDataEndpoint>
  >[] = [];

  const start = async (configs: StartMainThreadContextConfig) => {
    if (ssrDumpInfo) {
      const lynxUniqueIdToElement: WeakRef<HTMLElement>[] = [];
      const allLynxElements = shadowRoot.querySelectorAll<HTMLElement>(
        `[${lynxUniqueIdAttribute}]`,
      );
      const length = allLynxElements.length;
      for (let ii = 0; ii < length; ii++) {
        const element = allLynxElements[ii]! as HTMLElement;
        const lynxUniqueId = Number(
          element.getAttribute(lynxUniqueIdAttribute)!,
        );
        lynxUniqueIdToElement[lynxUniqueId] = new WeakRef<HTMLElement>(element);
      }
      const hydrateStyleElement = shadowRoot.querySelector(
        `style:nth-of-type(2)`,
      ) as HTMLStyleElement | null;
      const styleSheet = hydrateStyleElement?.sheet;
      const lynxUniqueIdToStyleRulesIndex: number[] = [];
      const cssRulesLength = styleSheet?.cssRules.length ?? 0;
      for (let ii = 0; ii < cssRulesLength; ii++) {
        const cssRule = styleSheet?.cssRules[ii];
        if (cssRule?.constructor.name === 'CSSStyleRule') {
          const lynxUniqueId = parseFloat(
            (cssRule as CSSStyleRule).selectorText.substring(
              lynxUniqueIdAttribute.length + 3, // skip `[`, `="`
            ),
          );
          if (lynxUniqueId !== undefined && !isNaN(lynxUniqueId)) {
            lynxUniqueIdToStyleRulesIndex[lynxUniqueId] = ii;
          }
        }
      }

      await startMainThread(configs, {
        // @ts-expect-error
        lynxUniqueIdToElement: lynxUniqueIdToElement,
        lynxUniqueIdToStyleRulesIndex,
        ...ssrDumpInfo,
        cardStyleElement: hydrateStyleElement,
      });
    } else {
      await startMainThread(configs);
    }

    // Process any pending update calls that were queued while mtsGlobalThis was undefined
    for (const args of pendingUpdateCalls) {
      mtsGlobalThis.updatePage?.(...args);
    }
    pendingUpdateCalls.length = 0;
  };
  const updateDataMainThread: RpcCallType<typeof updateDataEndpoint> = async (
    ...args
  ) => {
    if (mtsGlobalThis) {
      mtsGlobalThis.updatePage?.(...args);
    } else {
      // Cache the call if mtsGlobalThis is not yet initialized
      pendingUpdateCalls.push(args);
    }
  };
  const updateI18nResourcesMainThread = (data: Cloneable) => {
    i18nResources.setData(data as InitI18nResources);
  };
  return {
    start,
    updateDataMainThread,
    updateI18nResourcesMainThread,
  };
}
