// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* LYNX_NATIVE_MODULES_IMPORT */
import {
  type Cloneable,
  type NativeModuleEventHandler,
  type NativeModulesInitData,
  type NativeModulesMap,
} from '../../../types/index.js';
import {
  dispatchNativeModuleEventEndpoint,
  nativeModulesCallEndpoint,
  switchExposureServiceEndpoint,
} from '../../endpoints.js';
import type { Rpc } from '@lynx-js/web-worker-rpc';
import { createIntersectionObserverModule } from './createIntersectionObserverModule.js';

export async function createNativeModules(
  uiThreadRpc: Rpc,
  mainThreadRpc: Rpc,
  nativeModulesMap: NativeModulesMap,
  nativeModulesInitData?: NativeModulesInitData,
): Promise<Record<string, any>> {
  const switchExposure = mainThreadRpc.createCall(
    switchExposureServiceEndpoint,
  );
  const nativeModulesCall = uiThreadRpc.createCall(nativeModulesCallEndpoint);
  const lynxExposureModule = {
    resumeExposure() {
      switchExposure(true, true);
    },
    stopExposure(param: { sendEvent?: boolean }) {
      switchExposure(false, param.sendEvent ?? true);
    },
  };
  const bridgeModule = {
    call(
      name: string,
      data: Cloneable,
      callback: (ret: Cloneable) => void,
    ): void {
      nativeModulesCall(name, data, 'bridge').then(callback);
    },
  };
  const intersectionObserverModule = createIntersectionObserverModule(
    mainThreadRpc,
  );

  const nativeModules = {};
  const customNativeModules: Record<string, Record<string, any>> = {};
  const eventHandlers = new Map<string, NativeModuleEventHandler>();

  await Promise.all(
    Object.entries(nativeModulesMap).map(([moduleName, moduleStr]) => {
      const initData = nativeModulesInitData?.[moduleName];
      const setEventHandler = (
        handler: NativeModuleEventHandler | undefined,
      ) => {
        if (handler) {
          eventHandlers.set(moduleName, handler);
        } else {
          eventHandlers.delete(moduleName);
        }
      };
      return import(/* webpackIgnore: true */ moduleStr).then(
        module =>
          customNativeModules[moduleName] = module?.default?.(
            nativeModules,
            (name: string, data: Cloneable) =>
              nativeModulesCall(name, data, moduleName),
            { initData, setEventHandler },
          ),
      );
    }),
  );
  /* LYNX_NATIVE_MODULES_ADD */

  Object.assign(nativeModules, {
    bridge: bridgeModule,
    IntersectionObserverModule: intersectionObserverModule,
    LynxExposureModule: lynxExposureModule,
    ...customNativeModules,
  });

  // Register after all modules and the shared registry are ready so Rpc's
  // built-in message cache buffers and replays early events safely.
  uiThreadRpc.registerHandler(
    dispatchNativeModuleEventEndpoint,
    (moduleName, data) => {
      try {
        eventHandlers.get(moduleName)?.(data);
      } catch (error) {
        console.error(error);
      }
    },
  );

  return nativeModules;
}
