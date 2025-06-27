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
  type NativeApp,
  type LynxCrossThreadContext,
  systemInfo,
  type BackMainThreadContextConfig,
  I18nResource,
  reportErrorEndpoint,
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
  const reportError = uiThreadRpc.createCall(reportErrorEndpoint);
  const createBundleInitReturnObj = (): BundleInitReturnObj => {
    const entry = (globalThis.module as LynxJSModule).exports;
    return {
      init: (lynxCoreInject) => {
        lynxCoreInject.tt.lynxCoreInject = lynxCoreInject;
        lynxCoreInject.tt.globalThis ??= new Proxy(lynxCoreInject, {
          get(target, prop) {
            // @ts-expect-error
            return target[prop] ?? globalThis[prop];
          },
          set(target, prop, value) {
            // @ts-expect-error
            target[prop] = value;
            return true;
          },
          ownKeys(target) {
            return Reflect.ownKeys(target).filter((key) =>
              key !== 'globalThis'
            );
          },
        });
        Object.assign(lynxCoreInject.tt, {
          SystemInfo: { ...systemInfo, ...browserConfig },
        });
        const ret = entry?.(lynxCoreInject.tt);
        return ret;
      },
    };
  };
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
    loadScriptAsync: function(
      sourceURL: string,
      callback: (message: string | null, exports?: BundleInitReturnObj) => void,
    ): void {
      const manifestUrl = template.manifest[`/${sourceURL}`];
      if (manifestUrl) sourceURL = manifestUrl;
      import(
        /* webpackIgnore: true */
        sourceURL
      ).catch(callback).then(async () => {
        callback(null, createBundleInitReturnObj());
      });
    },
    loadScript: (sourceURL: string) => {
      const manifestUrl = template.manifest[`/${sourceURL}`];
      if (manifestUrl) sourceURL = manifestUrl;
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
      registerUpdateGlobalPropsHandler(uiThreadRpc, tt);
      registerUpdateI18nResource(uiThreadRpc, mainThreadRpc, i18nResource, tt);
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
    i18nResource,
    reportException: (err: Error, _: unknown) => reportError(err, _, release),
    __SetSourceMapRelease: (err: Error) => release = err.message,

    console: {
      ...Object.keys(console).reduce((acc, key) => {
        // @ts-expect-error key must be a keyof Console
        acc[key] = console[key].bind(console);
        return acc;
      }, {} as Console),
      alog: console.log.bind(console),
    },
  };
  return nativeApp;
}
