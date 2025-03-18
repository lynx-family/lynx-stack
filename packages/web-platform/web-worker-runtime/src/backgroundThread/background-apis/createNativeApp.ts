// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rpc } from '@lynx-js/web-worker-rpc';
import {
  callLepusMethodEndpoint,
  setNativePropsEndpoint,
  triggerComponentEventEndpoint,
  selectComponentEndpoint,
  type BundleInitReturnObj,
  type LynxJSModule,
  type LynxTemplate,
  type NativeApp,
  type NativeModulesMap,
} from '@lynx-js/web-constants';
import { createInvokeUIMethod } from './crossThreadHandlers/createInvokeUIMethod.js';
import { registerOnLifecycleEventHandler } from './crossThreadHandlers/registerOnLifecycleEventHandler.js';
import { registerPublicComponentEventHandler } from './crossThreadHandlers/registerPublicComponentEventHandler.js';
import { registerGlobalExposureEventHandler } from './crossThreadHandlers/registerGlobalExposureEventHandler.js';
import { createNativeModules } from './createNativeModules.js';
import { registerUpdateDataHandler } from './crossThreadHandlers/registerUpdateDataHandler.js';
import { registerPublishEventHandler } from './crossThreadHandlers/registerPublishEventHandler.js';
import { createPerformanceApis } from './createPerformanceApis.js';
import { registerPostTimingResultHandler } from './crossThreadHandlers/registerPostTimingResultHandler.js';
import { registerOnNativeAppReadyHandler } from './crossThreadHandlers/registerOnNativeAppReadyHandler.js';
import { registerSendGlobalEventHandler } from './crossThreadHandlers/registerSendGlobalEvent.js';
import { createJSObjectDestructionObserver } from './crossThreadHandlers/createJSObjectDestructionObserver.js';

let nativeAppCount = 0;

export async function createNativeApp(config: {
  template: LynxTemplate;
  uiThreadRpc: Rpc;
  mainThreadRpc: Rpc;
  markTimingInternal: (timingKey: string, pipelineId?: string) => void;
  nativeModulesMap: NativeModulesMap;
}): Promise<NativeApp> {
  const {
    mainThreadRpc,
    uiThreadRpc,
    markTimingInternal,
    template,
    nativeModulesMap,
  } = config;
  const { performanceApis, pipelineIdToTimingFlags } = createPerformanceApis(
    markTimingInternal,
  );
  const callLepusMethod = mainThreadRpc.createCallbackify(
    callLepusMethodEndpoint,
    2,
  );
  const setNativeProps = uiThreadRpc.createCall(setNativePropsEndpoint);
  const triggerComponentEvent = uiThreadRpc.createCall(
    triggerComponentEventEndpoint,
  );
  const selectComponent = uiThreadRpc.createCallbackify(
    selectComponentEndpoint,
    3,
  );
  const nativeApp: NativeApp = {
    id: (nativeAppCount++).toString(),
    ...performanceApis,
    setTimeout: setTimeout,
    setInterval: setInterval,
    clearTimeout: clearTimeout,
    clearInterval: clearInterval,
    nativeModuleProxy: await createNativeModules(
      uiThreadRpc,
      nativeModulesMap,
    ),
    loadScriptAsync: function(
      sourceURL: string,
      callback: (message: string | null, exports?: BundleInitReturnObj) => void,
    ): void {
      const mainfestUrl = template.manifest[`/${sourceURL}`];
      if (mainfestUrl) sourceURL = mainfestUrl;
      import(
        /* webpackIgnore: true */
        sourceURL
      ).catch(callback).then(async () => {
        callback(null, {
          init: (lynxCoreInject) => {
            lynxCoreInject.tt.lynxCoreInject = lynxCoreInject;
            lynxCoreInject.tt.globalThis ??= lynxCoreInject;
            const entry = (globalThis.module as LynxJSModule).exports;
            const ret = entry?.(lynxCoreInject.tt);
            return ret;
          },
        });
      });
    },
    loadScript: (sourceURL: string) => {
      const mainfestUrl = template.manifest[`/${sourceURL}`];
      if (mainfestUrl) sourceURL = mainfestUrl;
      importScripts(sourceURL);
      const entry = (globalThis.module as LynxJSModule).exports;
      return {
        init: (lynxCoreInject) => {
          return entry?.(lynxCoreInject.tt);
        },
      };
    },
    requestAnimationFrame(cb: FrameRequestCallback) {
      return requestAnimationFrame(cb);
    },
    cancelAnimationFrame(handler: number) {
      return cancelAnimationFrame(handler);
    },
    callLepusMethod,
    setNativeProps,
    invokeUIMethod: createInvokeUIMethod(uiThreadRpc),
    setCard(tt) {
      registerOnLifecycleEventHandler(
        mainThreadRpc,
        tt,
      );
      registerPublicComponentEventHandler(
        uiThreadRpc,
        tt,
      );
      registerPublishEventHandler(
        uiThreadRpc,
        tt,
      );
      registerGlobalExposureEventHandler(
        uiThreadRpc,
        tt,
      );
      registerUpdateDataHandler(
        uiThreadRpc,
        tt,
      );
      registerPostTimingResultHandler(
        uiThreadRpc,
        tt,
        pipelineIdToTimingFlags,
      );
      registerOnNativeAppReadyHandler(
        uiThreadRpc,
        tt,
      );
      registerSendGlobalEventHandler(
        uiThreadRpc,
        tt,
      );
    },
    triggerComponentEvent,
    selectComponent,
    createJSObjectDestructionObserver: createJSObjectDestructionObserver(),
  };
  return nativeApp;
}
