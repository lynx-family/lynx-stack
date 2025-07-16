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
} from '@lynx-js/web-constants';
import { Rpc } from '@lynx-js/web-worker-rpc';
import { dispatchLynxViewEvent } from '../utils/dispatchLynxViewEvent.js';
import { createExposureMonitor } from './crossThreadHandlers/createExposureMonitor.js';

const {
  prepareMainThreadAPIs,
} = await import('@lynx-js/web-mainthread-apis');

export function createRenderAllOnUI(
  mainToBackgroundRpc: Rpc,
  shadowRoot: ShadowRoot,
  markTimingInternal: (
    timingKey: string,
    pipelineId?: string,
    timeStamp?: number,
  ) => void,
  flushMarkTimingInternal: () => void,
  callbacks: {
    onError?: (err: Error, release: string, fileName: string) => void;
  },
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
  const { startMainThread } = prepareMainThreadAPIs(
    mainToBackgroundRpc,
    shadowRoot,
    document.createElement.bind(document),
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
  );
  let mtsGlobalThis!: MainThreadGlobalThis;
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

      mtsGlobalThis = await startMainThread(configs, {
        // @ts-expect-error
        lynxUniqueIdToElement: lynxUniqueIdToElement,
        lynxUniqueIdToStyleRulesIndex,
        ...ssrDumpInfo,
        cardStyleElement: hydrateStyleElement,
      });
    } else {
      mtsGlobalThis = await startMainThread(configs);
    }
  };
  const updateDataMainThread: RpcCallType<typeof updateDataEndpoint> = async (
    ...args
  ) => {
    mtsGlobalThis.updatePage?.(...args);
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
