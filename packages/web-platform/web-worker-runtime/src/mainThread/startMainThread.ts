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
  mtsQueryComponentEndpoint,
  mtsQueryComponentTemplateEndpoint,
} from '@lynx-js/web-constants';
import { Rpc } from '@lynx-js/web-worker-rpc';
import { createMarkTimingInternal } from './crossThreadHandlers/createMainthreadMarkTimingInternal.js';
import { OffscreenDocument } from '@lynx-js/offscreen-document/webworker';
import { _onEvent } from '@lynx-js/offscreen-document/webworker';
import { registerUpdateDataHandler } from './crossThreadHandlers/registerUpdateDataHandler.js';
import { executeTemplateEntry } from '@lynx-js/web-mainthread-apis';

export async function startMainThreadWorker(
  uiThreadPort: MessagePort,
  backgroundThreadPort: MessagePort,
) {
  const { prepareMainThreadAPIs } = await import(
    '@lynx-js/web-mainthread-apis'
  );
  const uiThreadRpc = new Rpc(uiThreadPort, 'main-to-ui');
  const backgroundThreadRpc = new Rpc(backgroundThreadPort, 'main-to-bg');
  const { markTimingInternal, flushMarkTimingInternal } =
    createMarkTimingInternal(backgroundThreadRpc);
  const uiFlush = uiThreadRpc.createCall(flushElementTreeEndpoint);
  const reportError = uiThreadRpc.createCall(reportErrorEndpoint);
  const triggerQueryComponent = (source: string) =>
    uiThreadRpc.invoke(mtsQueryComponentEndpoint, [source]);
  const triggerI18nResourceFallback = (
    options: I18nResourceTranslationOptions,
  ) => {
    uiThreadRpc.invoke(dispatchLynxViewEventEndpoint, [
      i18nResourceMissedEventName,
      options as CloneableObject,
    ]);
  };
  const docu = new OffscreenDocument({
    onCommit: uiFlush,
  });
  const i18nResources = new I18nResources();
  uiThreadRpc.registerHandler(postOffscreenEventEndpoint, docu[_onEvent]);
  const sendMultiThreadExposureChangedEndpoint = uiThreadRpc.createCall(
    multiThreadExposureChangedEndpoint,
  );
  // Indicates whether the template has been executed
  const templateEntries: Record<string, boolean> = {};
  const { startMainThread } = prepareMainThreadAPIs(
    backgroundThreadRpc,
    docu,
    docu.createElement.bind(docu),
    (exposureChangedElementUniqueIds) => {
      docu.commit();
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
    triggerQueryComponent,
    templateEntries,
  );
  uiThreadRpc.registerHandler(
    mainThreadStartEndpoint,
    (config) => {
      startMainThread(config).then(mtsGlobalThis => {
        registerUpdateDataHandler(uiThreadRpc, mtsGlobalThis);
        uiThreadRpc.registerHandler(
          mtsQueryComponentTemplateEndpoint,
          async (source, template) => {
            if (templateEntries[source]) return;
            executeTemplateEntry({
              template,
              rootDom: docu,
              createElement: docu.createElement.bind(docu) as any,
              source,
              mtsGlobalThis,
            });
            templateEntries[source] = true;
          },
        );
      });
    },
  );
  uiThreadRpc.registerHandler(updateI18nResourcesEndpoint, data => {
    i18nResources.setData(data as InitI18nResources);
  });
}
