// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Rpc } from '@lynx-js/web-worker-rpc';
import { createBackgroundLynx } from './createBackgroundLynx.js';
import { createNativeApp } from './createNativeApp.js';
import { registerDisposeHandler } from './crossThreadHandlers/registerDisposeHandler.js';
import { BackgroundThreadStartEndpoint } from '../../endpoints.js';
import { createNapiLoader } from './createNapiLoader.js';
import { createTimingSystem } from './createTimingSystem.js';
import type { WorkerStartMessage } from '../../../types/WorkerStartMessage.js';

export function startBackgroundThread(
  startMessage: WorkerStartMessage,
): void {
  const {
    mainThreadMessagePort,
    napiModulesMap,
    nativeModulesMap,
    initData,
    globalProps,
    customSections,
    cardType,
    entryTemplateUrl,
  } = startMessage;
  const mainThreadPort = mainThreadMessagePort;
  const mainThreadRpc = new Rpc(mainThreadPort, 'bg-to-main');
  const timingSystem = createTimingSystem(mainThreadRpc, mainThreadRpc);
  timingSystem.markTimingInternal('load_core_start');
  const nativeApp = createNativeApp(
    mainThreadRpc,
    timingSystem,
    nativeModulesMap,
    entryTemplateUrl,
  );
  const lynxCore = import(
    /* webpackChunkName: "lynx-core-chunk" */
    '@lynx-js/lynx-core/web'
  );
  const napiLoader = createNapiLoader(
    mainThreadRpc,
    napiModulesMap,
  );
  Promise.all([lynxCore, nativeApp, napiLoader]).then(
    ([lynxCore, nativeApp, napiLoader]) => {
      timingSystem.markTimingInternal('load_core_end');
      (globalThis as any)['napiLoaderOnRT' + nativeApp.id] = napiLoader;
      const nativeLynx = createBackgroundLynx(
        globalProps,
        customSections,
        nativeApp,
        mainThreadRpc,
      );
      const {
        loadCard,
        destroyCard,
        callDestroyLifetimeFun,
        nativeGlobal,
        loadDynamicComponent,
      } = lynxCore;
      // @lynx-js/lynx-core >= 0.1.3 will export nativeGlobal and loadDynamicComponent
      if (nativeGlobal && loadDynamicComponent) {
        nativeGlobal.loadDynamicComponent = loadDynamicComponent;
      }
      mainThreadRpc.registerHandler(
        BackgroundThreadStartEndpoint,
        () => {
          loadCard(nativeApp, {
            initData,
            cardType,
            // @ts-ignore
            updateData: initData,
          }, nativeLynx);
        },
      );
      registerDisposeHandler(
        mainThreadRpc,
        nativeApp,
        destroyCard,
        callDestroyLifetimeFun,
      );
    },
  );
}
