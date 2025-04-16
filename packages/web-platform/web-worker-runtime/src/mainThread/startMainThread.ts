// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  BackgroundThreadStartEndpoint,
  mainThreadStartEndpoint,
  type LynxJSModule,
  flushElementTreeEndpoint,
  reportErrorEndpoint,
  publishEventEndpoint,
  publicComponentEventEndpoint,
  postExposureEndpoint,
  postOffscreenEventEndpoint,
  switchExposureServiceEndpoint,
  postTimingFlagsEndpoint,
  dispatchCoreContextOnBackgroundEndpoint,
  dispatchJSContextOnMainThreadEndpoint,
} from '@lynx-js/web-constants';
import { Rpc } from '@lynx-js/web-worker-rpc';
import {
  MainThreadRuntime,
  switchExposureService,
} from '@lynx-js/web-mainthread-apis';
import { registerCallLepusMethodHandler } from './crossThreadHandlers/registerCallLepusMethodHandler.js';
import { registerGetCustomSectionHandler } from './crossThreadHandlers/registerGetCustomSectionHandler.js';
import { createMarkTimingInternal } from './crossThreadHandlers/createMainthreadMarkTimingInternal.js';
import { registerUpdateDataHandler } from './crossThreadHandlers/registerUpdateDataHandler.js';
import { OffscreenDocument } from '@lynx-js/offscreen-document/webworker';
import {
  type ElementOperation,
  _onEvent,
} from '@lynx-js/offscreen-document/webworker';
import { LynxCrossThreadContext } from '../common/LynxCrossThreadContext.js';

export function startMainThread(
  uiThreadPort: MessagePort,
  backgroundThreadPort: MessagePort,
): void {
  const uiThreadRpc = new Rpc(uiThreadPort, 'main-to-ui');
  const backgroundThreadRpc = new Rpc(backgroundThreadPort, 'main-to-bg');
  const markTimingInternal = createMarkTimingInternal(backgroundThreadRpc);
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
  let operations: ElementOperation[] = [];
  const flushElementTree = uiThreadRpc.createCall(flushElementTreeEndpoint);
  const reportError = uiThreadRpc.createCall(reportErrorEndpoint);
  markTimingInternal('lepus_excute_start');
  uiThreadRpc.registerHandler(
    mainThreadStartEndpoint,
    async (config) => {
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
      await import(
        /* webpackIgnore: true */ template.lepusCode.root
      );
      const entry = (globalThis.module as LynxJSModule).exports!;
      const docu = new OffscreenDocument({
        onCommit: (currentOperations) => {
          operations = currentOperations;
        },
      });
      uiThreadRpc.registerHandler(postOffscreenEventEndpoint, docu[_onEvent]);
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
        lepusCode,
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
            registerUpdateDataHandler(uiThreadRpc, runtime);
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
            });

            runtime.renderPage!(initData);
            runtime.__FlushElementTree(undefined, {});
          },
          flushElementTree: async (options, timingFlags) => {
            const pipelineId = options?.pipelineOptions?.pipelineID;
            markTimingInternal('dispatch_start', pipelineId);
            docu.commit();
            if (isFp) {
              isFp = false;
              jsContext.dispatchEvent({
                type: '__OnNativeAppReady',
                data: undefined,
              });
            }
            markTimingInternal('layout_start', pipelineId);
            markTimingInternal('ui_operation_flush_start', pipelineId);
            await flushElementTree(operations);
            markTimingInternal('ui_operation_flush_end', pipelineId);
            markTimingInternal('layout_end', pipelineId);
            markTimingInternal('dispatch_end', pipelineId);
            postTimingFlags(timingFlags, pipelineId);
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
    },
  );
}
