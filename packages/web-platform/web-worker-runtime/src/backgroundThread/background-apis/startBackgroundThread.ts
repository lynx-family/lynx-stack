// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Rpc } from '@lynx-js/web-worker-rpc';
import { createBackgroundLynx } from './createBackgroundLynx.js';
import { createNativeApp } from './createNativeApp.js';
import { registerDisposeHandler } from './crossThreadHandlers/registerDisposeHandler.js';
import { BackgroundThreadStartEndpoint } from '@lynx-js/web-constants';
import { createNapiLoader } from './createNapiLoader.js';
import { createTimingSystem } from './createTimingSystem.js';

const lynxCore = import(
  /* webpackMode: "eager" */ '@lynx-js/lynx-core/web'
);

export function startBackgroundThread(
  uiThreadPort: MessagePort,
  mainThreadPort: MessagePort,
): void {
  const uiThreadRpc = new Rpc(uiThreadPort, 'bg-to-ui');
  const mainThreadRpc = new Rpc(mainThreadPort, 'bg-to-main');
  const timingSystem = createTimingSystem(mainThreadRpc, uiThreadRpc);
  timingSystem.markTimingInternal('load_core_start');
  mainThreadRpc.registerHandler(
    BackgroundThreadStartEndpoint,
    async (config) => {
      timingSystem.markTimingInternal('load_core_end');
      const nativeApp = await createNativeApp({
        ...config,
        uiThreadRpc,
        mainThreadRpc,
        timingSystem,
      });
      (globalThis as any)['napiLoaderOnRT' + nativeApp.id] =
        await createNapiLoader(
          uiThreadRpc,
          config.napiModulesMap,
        );

      const nativeLynx = createBackgroundLynx(
        config,
        nativeApp,
        mainThreadRpc,
        uiThreadRpc,
      );
      lynxCore.then(
        (
          {
            loadCard,
            destroyCard,
            callDestroyLifetimeFun,
            nativeGlobal,
            loadDynamicComponent,
          },
        ) => {
          // @lynx-js/lynx-core >= 0.1.3 will export nativeGlobal and loadDynamicComponent
          if (nativeGlobal && loadDynamicComponent) {
            nativeGlobal.loadDynamicComponent = loadDynamicComponent;
          }
          loadCard(nativeApp, {
            ...config,
            // @ts-ignore
            updateData: config.initData,
          }, nativeLynx);
          registerDisposeHandler(
            uiThreadRpc,
            nativeApp,
            destroyCard,
            callDestroyLifetimeFun,
          );
        },
      );
    },
  );
}
