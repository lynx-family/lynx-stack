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
  type LynxCrossThreadContext,
  type BrowserConfig,
  systemInfo,
} from '@lynx-js/web-constants';
import { createInvokeUIMethod } from './crossThreadHandlers/createInvokeUIMethod.js';
import { registerPublicComponentEventHandler } from './crossThreadHandlers/registerPublicComponentEventHandler.js';
import { registerGlobalExposureEventHandler } from './crossThreadHandlers/registerGlobalExposureEventHandler.js';
import { createNativeModules } from './createNativeModules.js';
import { registerUpdateDataHandler } from './crossThreadHandlers/registerUpdateDataHandler.js';
import { registerPublishEventHandler } from './crossThreadHandlers/registerPublishEventHandler.js';
import { createPerformanceApis } from './createPerformanceApis.js';
import { registerSendGlobalEventHandler } from './crossThreadHandlers/registerSendGlobalEvent.js';
import { createJSObjectDestructionObserver } from './crossThreadHandlers/createJSObjectDestructionObserver.js';
import type { TimingSystem } from './createTimingSystem.js';

let nativeAppCount = 0;
const sharedData: Record<string, unknown> = {};

export async function createNativeApp(config: {
  template: LynxTemplate;
  uiThreadRpc: Rpc;
  mainThreadRpc: Rpc;
  nativeModulesMap: NativeModulesMap;
  timingSystem: TimingSystem;
  browserConfig: BrowserConfig;
}): Promise<NativeApp> {
  const {
    mainThreadRpc,
    uiThreadRpc,
    template,
    nativeModulesMap,
    timingSystem,
    browserConfig,
  } = config;
  const performanceApis = createPerformanceApis(
    timingSystem,
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
  const createBundleInitReturnObj = (): BundleInitReturnObj => {
    const entry = (globalThis.module as LynxJSModule).exports;
    return {
      init: (lynxCoreInject) => {
        lynxCoreInject.tt.lynxCoreInject = lynxCoreInject;
        lynxCoreInject.tt.globalThis ??= lynxCoreInject;
        Object.assign(lynxCoreInject.tt, {
          SystemInfo: { ...systemInfo, ...browserConfig },
        });
        const ret = entry?.(lynxCoreInject.tt);
        return ret;
      },
    };
  };
  const nativeApp: NativeApp = {
    id: (nativeAppCount++).toString(),
    ...performanceApis,
    setTimeout: setTimeout,
    setInterval: setInterval,
    clearTimeout: clearTimeout,
    clearInterval: clearInterval,
    nativeModuleProxy: await createNativeModules(
      uiThreadRpc,
      mainThreadRpc,
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
        callback(null, createBundleInitReturnObj());
      });
    },
    loadScript: (sourceURL: string) => {
      const mainfestUrl = template.manifest[`/${sourceURL}`];
      if (mainfestUrl) sourceURL = mainfestUrl;
      importScripts(sourceURL);
      return createBundleInitReturnObj();
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
      registerPublicComponentEventHandler(
        mainThreadRpc,
        tt,
      );
      registerPublishEventHandler(
        mainThreadRpc,
        tt,
      );
      registerGlobalExposureEventHandler(
        mainThreadRpc,
        tt,
      );
      registerUpdateDataHandler(
        uiThreadRpc,
        tt,
      );
      registerSendGlobalEventHandler(
        uiThreadRpc,
        tt,
      );
      timingSystem.registerGlobalEmitter(tt.GlobalEventEmitter);
      (tt.lynx.getCoreContext() as LynxCrossThreadContext).__start();
    },
    triggerComponentEvent,
    selectComponent,
    createJSObjectDestructionObserver: createJSObjectDestructionObserver(),
    setSharedData<T>(dataKey: string, dataVal: T) {
      sharedData[dataKey] = dataVal;
    },
    getSharedData<T>(dataKey: string): T | undefined {
      return sharedData[dataKey] as T | undefined;
    },
  };
  return nativeApp;
}
