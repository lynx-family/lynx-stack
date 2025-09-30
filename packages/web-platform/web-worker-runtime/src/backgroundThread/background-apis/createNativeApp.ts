// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rpc } from '@lynx-js/web-worker-rpc';
import {
  callLepusMethodEndpoint,
  setNativePropsEndpoint,
  triggerComponentEventEndpoint,
  selectComponentEndpoint,
  type NativeApp,
  type LynxCrossThreadContext,
  type BackMainThreadContextConfig,
  I18nResource,
  reportErrorEndpoint,
  queryComponentEndpoint,
  updateBTSTemplateCacheEndpoint,
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
import { registerUpdateGlobalPropsHandler } from './crossThreadHandlers/registerUpdateGlobalPropsHandler.js';
import { registerUpdateI18nResource } from './crossThreadHandlers/registerUpdateI18nResource.js';
import { createGetPathInfo } from './crossThreadHandlers/createGetPathInfo.js';
import { createChunkLoading } from './createChunkLoading.js';

let nativeAppCount = 0;
const sharedData: Record<string, unknown> = {};

export async function createNativeApp(
  config: {
    uiThreadRpc: Rpc;
    mainThreadRpc: Rpc;
    timingSystem: TimingSystem;
  } & BackMainThreadContextConfig,
): Promise<NativeApp> {
  const {
    mainThreadRpc,
    uiThreadRpc,
    template,
    nativeModulesMap,
    timingSystem,
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
  const queryComponent = mainThreadRpc.createCall(
    queryComponentEndpoint,
  );
  const reportError = uiThreadRpc.createCall(reportErrorEndpoint);
  const { templateCache, loadScript, loadScriptAsync, readScript } =
    createChunkLoading(template);

  mainThreadRpc.registerHandler(
    updateBTSTemplateCacheEndpoint,
    (url, template) => {
      templateCache.set(url, template);
    },
  );
  const i18nResource = new I18nResource();
  let release = '';
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
    readScript,
    loadScriptAsync,
    loadScript,
    requestAnimationFrame(cb: FrameRequestCallback) {
      return requestAnimationFrame(cb);
    },
    cancelAnimationFrame(handler: number) {
      return cancelAnimationFrame(handler);
    },
    callLepusMethod,
    setNativeProps,
    getPathInfo: createGetPathInfo(uiThreadRpc),
    invokeUIMethod: createInvokeUIMethod(uiThreadRpc),
    tt: null,
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
        mainThreadRpc,
        tt,
      );
      registerSendGlobalEventHandler(
        uiThreadRpc,
        tt,
      );
      registerUpdateGlobalPropsHandler(uiThreadRpc, tt);
      registerUpdateI18nResource(uiThreadRpc, mainThreadRpc, i18nResource, tt);
      timingSystem.registerGlobalEmitter(tt.GlobalEventEmitter);
      (tt.lynx.getCoreContext() as LynxCrossThreadContext).__start();
      nativeApp.tt = tt;
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
    i18nResource,
    reportException: (err: Error, _: unknown) => reportError(err, _, release),
    __SetSourceMapRelease: (err: Error) => release = err.message,
    queryComponent: (source, callback) => {
      if (templateCache.has(source)) {
        callback({ __hasReady: true });
      } else {
        queryComponent(source).then(res => {
          callback?.(res);
        });
      }
    },
  };
  return nativeApp;
}
