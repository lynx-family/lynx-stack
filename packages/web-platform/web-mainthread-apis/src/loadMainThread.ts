// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  BackgroundThreadStartEndpoint,
  type LynxJSModule,
  publishEventEndpoint,
  publicComponentEventEndpoint,
  postExposureEndpoint,
  switchExposureServiceEndpoint,
  postTimingFlagsEndpoint,
  dispatchCoreContextOnBackgroundEndpoint,
  dispatchJSContextOnMainThreadEndpoint,
  type Rpc,
  type MainThreadStartConfigs,
  LynxCrossThreadContext,
  type RpcCallType,
  type reportErrorEndpoint,
} from '@lynx-js/web-constants';
import { registerCallLepusMethodHandler } from './crossThreadHandlers/registerCallLepusMethodHandler.js';
import { registerGetCustomSectionHandler } from './crossThreadHandlers/registerGetCustomSectionHandler.js';
import {
  MainThreadRuntime,
  switchExposureService,
} from './MainThreadRuntime.js';

const moduleCache: Record<string, LynxJSModule> = {};
export function loadMainThread(
  backgroundThreadRpc: Rpc,
  docu: Pick<Document, 'append' | 'createElement' | 'addEventListener'>,
  commitDocument: () => Promise<void> | void,
  markTimingInternal: (timingKey: string, pipelineId?: string) => void,
  reportError: RpcCallType<typeof reportErrorEndpoint>,
) {
  const postTimingFlags = backgroundThreadRpc.createCall(
    postTimingFlagsEndpoint,
  );
  const backgroundStart = backgroundThreadRpc.createCall(
    BackgroundThreadStartEndpoint,
  );
  const publishEvent = backgroundThreadRpc.createCall(
    publishEventEndpoint,
  );
  const publicComponentEvent = backgroundThreadRpc.createCall(
    publicComponentEventEndpoint,
  );
  const postExposure = backgroundThreadRpc.createCall(postExposureEndpoint);
  markTimingInternal('lepus_execute_start');
  async function startMainThread(
    config: MainThreadStartConfigs,
  ): Promise<MainThreadRuntime> {
    let isFp = true;
    const {
      globalProps,
      template,
      browserConfig,
      nativeModulesMap,
      napiModulesMap,
      tagMap,
    } = config;
    const { styleInfo, pageConfig, customSections, cardType, lepusCode } =
      template;
    markTimingInternal('decode_start');
    const lepusCodeEntries = await Promise.all(
      Object.entries(lepusCode).map(async ([name, url]) => {
        const cachedModule = moduleCache[url];
        if (cachedModule) {
          return [name, cachedModule] as [string, LynxJSModule];
        } else {
          Object.assign(globalThis, { module: {} });
          await import(/* webpackIgnore: true */ url);
          const module = globalThis.module as LynxJSModule;
          Object.assign(globalThis, { module: {} });
          moduleCache[url] = module;
          return [name, module] as [string, LynxJSModule];
        }
      }),
    );
    const lepusCodeLoaded = Object.fromEntries(lepusCodeEntries);
    const entry = lepusCodeLoaded['root']!.exports;
    const jsContext = new LynxCrossThreadContext({
      rpc: backgroundThreadRpc,
      receiveEventEndpoint: dispatchJSContextOnMainThreadEndpoint,
      sendEventEndpoint: dispatchCoreContextOnBackgroundEndpoint,
    });
    const runtime = new MainThreadRuntime({
      jsContext,
      tagMap,
      browserConfig,
      customSections,
      globalProps,
      pageConfig,
      styleInfo,
      lepusCode: lepusCodeLoaded,
      docu,
      callbacks: {
        mainChunkReady: () => {
          markTimingInternal('data_processor_start');
          const initData = runtime.processData
            ? runtime.processData(config.initData)
            : config.initData;
          markTimingInternal('data_processor_end');
          registerCallLepusMethodHandler(
            backgroundThreadRpc,
            runtime,
          );
          registerGetCustomSectionHandler(
            backgroundThreadRpc,
            customSections,
          );
          backgroundThreadRpc.registerHandler(
            switchExposureServiceEndpoint,
            runtime[switchExposureService],
          );
          backgroundStart({
            initData,
            globalProps,
            template,
            cardType: cardType ?? 'react',
            customSections: Object.fromEntries(
              Object.entries(customSections).filter(([, value]) =>
                value.type !== 'lazy'
              ).map(([k, v]) => [k, v.content]),
            ),
            nativeModulesMap,
            napiModulesMap,
            browserConfig,
          });

          runtime.renderPage!(initData);
          runtime.__FlushElementTree(undefined, {});
        },
        flushElementTree: async (options, timingFlags) => {
          const pipelineId = options?.pipelineOptions?.pipelineID;
          markTimingInternal('dispatch_start', pipelineId);
          if (isFp) {
            isFp = false;
            jsContext.dispatchEvent({
              type: '__OnNativeAppReady',
              data: undefined,
            });
          }
          markTimingInternal('layout_start', pipelineId);
          markTimingInternal('ui_operation_flush_start', pipelineId);
          await commitDocument();
          markTimingInternal('ui_operation_flush_end', pipelineId);
          markTimingInternal('layout_end', pipelineId);
          markTimingInternal('dispatch_end', pipelineId);
          requestAnimationFrame(() => {
            postTimingFlags(timingFlags, pipelineId);
          });
        },
        _ReportError: reportError,
        __OnLifecycleEvent: (data) => {
          jsContext.dispatchEvent({
            type: '__OnLifecycleEvent',
            data,
          });
        },
        /**
         * Note :
         * The parameter of lynx.performance.markTiming is (pipelineId:string, timingFlag:string)=>void
         * But our markTimingInternal is (timingFlag:string, pipelineId?:string, timeStamp?:number) => void
         */
        markTiming: (a, b) => markTimingInternal(b, a),
        publishEvent,
        publicComponentEvent,
        postExposure,
      },
    }).globalThis;
    markTimingInternal('decode_end');
    entry!(runtime);
    jsContext.__start(); // start the jsContext after the runtime is created
    return runtime;
  }
  return { startMainThread };
}
