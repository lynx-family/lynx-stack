// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  flushElementTreeEndpoint,
  mainThreadStartEndpoint,
  postOffscreenEventEndpoint,
  reportErrorEndpoint,
  getCacheI18nResourcesKey,
  i18nResourceTranslationEndpoint,
  type I18nResourceTranslationOptions,
} from '@lynx-js/web-constants';
import { Rpc } from '@lynx-js/web-worker-rpc';
import { createMarkTimingInternal } from './crossThreadHandlers/createMainthreadMarkTimingInternal.js';
import { OffscreenDocument } from '@lynx-js/offscreen-document/webworker';
import { _onEvent } from '@lynx-js/offscreen-document/webworker';
import { registerUpdateDataHandler } from './crossThreadHandlers/registerUpdateDataHandler.js';
const { prepareMainThreadAPIs } = await import('@lynx-js/web-mainthread-apis');

const CacheI18nResources = new Map<string, unknown>();

export function startMainThreadWorker(
  uiThreadPort: MessagePort,
  backgroundThreadPort: MessagePort,
) {
  const uiThreadRpc = new Rpc(uiThreadPort, 'main-to-ui');
  const backgroundThreadRpc = new Rpc(backgroundThreadPort, 'main-to-bg');
  const markTimingInternal = createMarkTimingInternal(backgroundThreadRpc);
  const uiFlush = uiThreadRpc.createCall(flushElementTreeEndpoint);
  const reportError = uiThreadRpc.createCall(reportErrorEndpoint);
  const i18nResourceTranslation = (options: I18nResourceTranslationOptions) => {
    const cacheKey = getCacheI18nResourcesKey(options);

    if (CacheI18nResources.has(cacheKey)) {
      return CacheI18nResources.get(cacheKey);
    }
    backgroundThreadRpc.invoke(i18nResourceTranslationEndpoint, [options]).then(
      res => {
        if (res !== undefined) {
          CacheI18nResources.set(cacheKey, res);
        }
      },
    );
    return undefined;
  };
  const docu = new OffscreenDocument({
    onCommit: uiFlush,
  });
  uiThreadRpc.registerHandler(postOffscreenEventEndpoint, docu[_onEvent]);
  const { startMainThread } = prepareMainThreadAPIs(
    backgroundThreadRpc,
    docu,
    docu.createElement.bind(docu),
    docu.commit.bind(docu),
    markTimingInternal,
    reportError,
    i18nResourceTranslation,
  );
  uiThreadRpc.registerHandler(
    mainThreadStartEndpoint,
    (config) => {
      startMainThread(config).then((runtime) => {
        registerUpdateDataHandler(uiThreadRpc, runtime);
      });
    },
  );
}
