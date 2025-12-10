// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  flushElementTreeEndpoint,
  mainThreadStartEndpoint,
  postOffscreenEventEndpoint,
  reportErrorEndpoint,
  type I18nResourceTranslationOptions,
  dispatchLynxViewEventEndpoint,
  type CloneableObject,
  i18nResourceMissedEventName,
  I18nResources,
  type InitI18nResources,
  updateI18nResourcesEndpoint,
  multiThreadExposureChangedEndpoint,
  lynxUniqueIdAttribute,
  type JSRealm,
  loadTemplateMultiThread,
} from '@lynx-js/web-constants';
import { Rpc } from '@lynx-js/web-worker-rpc';
import { createMarkTimingInternal } from './crossThreadHandlers/createMainthreadMarkTimingInternal.js';
import { OffscreenDocument } from '@lynx-js/offscreen-document/webworker';
import { _onEvent } from '@lynx-js/offscreen-document/webworker';
import { registerUpdateDataHandler } from './crossThreadHandlers/registerUpdateDataHandler.js';

const { prepareMainThreadAPIs } = await import(
  /* webpackChunkName: "web-core-main-thread-apis" */
  /* webpackMode: "lazy-once" */
  /* webpackPreload: true */
  /* webpackPrefetch: true */
  /* webpackFetchPriority: "high" */
  '@lynx-js/web-mainthread-apis'
);
function loadScriptSync(url: string): unknown {
  globalThis.module.exports = null;
  importScripts(url);
  const ret = globalThis.module?.exports;
  return ret;
}

function loadScript(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then(() => {
        globalThis.module.exports = null;
        importScripts(url);
        const ret = globalThis.module?.exports;
        resolve(ret);
      }).catch(reject);
  });
}

function createCurrentWorkerRealm(): JSRealm {
  return {
    globalWindow: globalThis,
    loadScript,
    loadScriptSync,
  };
}

export async function startMainThreadWorker(
  uiThreadPort: MessagePort,
  backgroundThreadPort: MessagePort,
) {
  const uiThreadRpc = new Rpc(uiThreadPort, 'main-to-ui');
  const backgroundThreadRpc = new Rpc(backgroundThreadPort, 'main-to-bg');
  const { markTimingInternal, flushMarkTimingInternal } =
    createMarkTimingInternal(backgroundThreadRpc);
  const uiFlush = uiThreadRpc.createCall(flushElementTreeEndpoint);
  const reportError = uiThreadRpc.createCall(reportErrorEndpoint);
  const triggerI18nResourceFallback = (
    options: I18nResourceTranslationOptions,
  ) => {
    uiThreadRpc.invoke(dispatchLynxViewEventEndpoint, [
      i18nResourceMissedEventName,
      options as CloneableObject,
    ]);
  };
  const document = new OffscreenDocument({
    onCommit: uiFlush,
  });
  Object.assign(globalThis, {
    document,
  });
  const mtsRealm = createCurrentWorkerRealm();
  const i18nResources = new I18nResources();
  uiThreadRpc.registerHandler(postOffscreenEventEndpoint, document[_onEvent]);
  const sendMultiThreadExposureChangedEndpoint = uiThreadRpc.createCall(
    multiThreadExposureChangedEndpoint,
  );
  const loadTemplate = uiThreadRpc.createCall(loadTemplateMultiThread);
  const { startMainThread, handleUpdatedData } = prepareMainThreadAPIs(
    backgroundThreadRpc,
    document, // rootDom
    document,
    mtsRealm,
    (exposureChangedElementUniqueIds) => {
      document.commit();
      sendMultiThreadExposureChangedEndpoint(
        exposureChangedElementUniqueIds
          .map(e => e.getAttribute(lynxUniqueIdAttribute))
          .filter(id => id !== null),
      );
    },
    markTimingInternal,
    flushMarkTimingInternal,
    reportError,
    triggerI18nResourceFallback,
    (initI18nResources: InitI18nResources) => {
      i18nResources.setData(initI18nResources);
      return i18nResources;
    },
    loadTemplate,
    undefined,
    false,
  );
  uiThreadRpc.registerHandler(
    mainThreadStartEndpoint,
    async (config) => {
      await startMainThread(config);
      registerUpdateDataHandler(
        uiThreadRpc,
        handleUpdatedData,
      );
    },
  );
  uiThreadRpc.registerHandler(updateI18nResourcesEndpoint, data => {
    i18nResources.setData(data as InitI18nResources);
  });
}
