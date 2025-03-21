// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  BackgroundThreadStartEndpoint,
  mainThreadChunkReadyEndpoint,
  mainThreadStartEndpoint,
  onLifecycleEventEndpoint,
  type LynxJSModule,
  flushElementTreeEndpoint,
  reportErrorEndpoint,
} from '@lynx-js/web-constants';
import { Rpc } from '@lynx-js/web-worker-rpc';
import { MainThreadRuntime } from '@lynx-js/web-mainthread-apis';
import { registerCallLepusMethodHandler } from './crossThreadHandlers/registerCallLepusMethodHandler.js';
import { registerPostMainThreadEventHandler } from './crossThreadHandlers/registerPostMainThreadEventHandler.js';
import { registerGetCustomSectionHandler } from './crossThreadHandlers/registerGetCustomSectionHandler.js';
import { createMarkTimingInternal } from './crossThreadHandlers/createMainthreadMarkTimingInternal.js';
import { registerUpdateDataHandler } from './crossThreadHandlers/registerUpdateDataHandler.js';

export function startMainThread(
  uiThreadPort: MessagePort,
  backgroundThreadPort: MessagePort,
): void {
  const uiThreadRpc = new Rpc(uiThreadPort, 'main-to-ui');
  const backgroundThreadRpc = new Rpc(backgroundThreadPort, 'main-to-bg');
  const markTimingInternal = createMarkTimingInternal(uiThreadRpc);
  const backgroundStart = backgroundThreadRpc.createCall(
    BackgroundThreadStartEndpoint,
  );
  const __OnLifecycleEvent = backgroundThreadRpc.createCall(
    onLifecycleEventEndpoint,
  );
  const mainThreadChunkReady = uiThreadRpc.createCall(
    mainThreadChunkReadyEndpoint,
  );
  const flushElementTree = uiThreadRpc.createCall(flushElementTreeEndpoint);
  const reportError = uiThreadRpc.createCall(reportErrorEndpoint);
  markTimingInternal('lepus_excute_start');
  uiThreadRpc.registerHandler(
    mainThreadStartEndpoint,
    async (config) => {
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
      const runtime = new MainThreadRuntime({
        tagMap,
        browserConfig,
        customSections,
        globalProps,
        pageConfig,
        styleInfo,
        lepusCode,
        callbacks: {
          mainChunkReady: function(): void {
            mainThreadChunkReady({ pageConfig });
            markTimingInternal('data_processor_start');
            const initData = runtime.processData
              ? runtime.processData(config.initData)
              : config.initData;
            markTimingInternal('data_processor_end');
            registerCallLepusMethodHandler(
              backgroundThreadRpc,
              runtime,
            );
            registerPostMainThreadEventHandler(
              uiThreadRpc,
            );
            registerGetCustomSectionHandler(
              backgroundThreadRpc,
              customSections,
            );
            registerUpdateDataHandler(uiThreadRpc, runtime);
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
          flushElementTree,
          _ReportError: reportError,
          __OnLifecycleEvent,
          /**
           * Note :
           * The parameter of lynx.performance.markTiming is (pipelineId:string, timingFlag:string)=>void
           * But our markTimingInternal is (timingFlag:string, pipelineId?:string, timeStamp?:number) => void
           */
          markTiming: (a, b) => markTimingInternal(b, a),
        },
      }).globalThis;
      markTimingInternal('decode_end');
      entry!(runtime);
    },
  );
}
