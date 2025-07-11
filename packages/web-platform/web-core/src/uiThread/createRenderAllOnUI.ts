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
    const mainThreadRuntime = startMainThread(configs);
    mtsGlobalThis = await mainThreadRuntime;
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
