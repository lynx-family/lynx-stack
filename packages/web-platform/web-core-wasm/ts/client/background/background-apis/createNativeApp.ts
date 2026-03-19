// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rpc } from '@lynx-js/web-worker-rpc';
import type {
  Cloneable,
  II18nResource,
  NativeApp,
  NativeModulesMap,
} from '../../../types/index.js';
import {
  callLepusMethodEndpoint,
  setNativePropsEndpoint,
  triggerComponentEventEndpoint,
  selectComponentEndpoint,
  reportErrorEndpoint,
  queryComponentEndpoint,
  updateBTSChunkEndpoint,
} from '../../endpoints.js';
import { createInvokeUIMethod } from './crossThreadHandlers/createInvokeUIMethod.js';
import { registerPublicComponentEventHandler } from './crossThreadHandlers/registerPublicComponentEventHandler.js';
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
import type { LynxCrossThreadContext } from '../../LynxCrossThreadContext.js';

let nativeAppCount = 0;
const sharedData: Record<string, unknown> = {};
class I18nResource implements II18nResource {
  data?: Cloneable;
  constructor(data?: Cloneable) {
    this.data = data;
  }
  setData(data: Cloneable) {
    this.data = data;
  }
}
export async function createNativeApp(
  mainThreadRpc: Rpc,
  timingSystem: TimingSystem,
  nativeModulesMap: NativeModulesMap,
  entryTemplateUrl: string,
): Promise<NativeApp> {
  const performanceApis = createPerformanceApis(
    timingSystem,
  );
  const callLepusMethod = mainThreadRpc.createCallbackify(
    callLepusMethodEndpoint,
    2,
  );
  const setNativeProps = mainThreadRpc.createCall(setNativePropsEndpoint);
  const triggerComponentEvent = mainThreadRpc.createCall(
    triggerComponentEventEndpoint,
  );
  const selectComponent = mainThreadRpc.createCallbackify(
    selectComponentEndpoint,
    3,
  );
  const queryComponent = mainThreadRpc.createCall(
    queryComponentEndpoint,
  );
  const reportError = mainThreadRpc.createCall(reportErrorEndpoint);
  const { templateCache, loadScript, loadScriptAsync, readScript } =
    createChunkLoading(entryTemplateUrl);

  mainThreadRpc.registerHandler(
    updateBTSChunkEndpoint,
    (url, btsChunkUrls) => {
      templateCache.set(url, btsChunkUrls);
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
      mainThreadRpc,
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
    getPathInfo: createGetPathInfo(mainThreadRpc),
    invokeUIMethod: createInvokeUIMethod(mainThreadRpc),
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
      registerUpdateDataHandler(
        mainThreadRpc,
        tt,
      );
      registerSendGlobalEventHandler(
        mainThreadRpc,
        tt,
      );
      registerUpdateGlobalPropsHandler(mainThreadRpc, tt);
      registerUpdateI18nResource(
        mainThreadRpc,
        i18nResource,
        tt,
      );
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
    __GetSourceMapRelease: (_url: string) => release,
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
