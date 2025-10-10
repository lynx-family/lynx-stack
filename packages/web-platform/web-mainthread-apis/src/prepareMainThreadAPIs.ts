// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  BackgroundThreadStartEndpoint,
  publishEventEndpoint,
  publicComponentEventEndpoint,
  postExposureEndpoint,
  postTimingFlagsEndpoint,
  dispatchCoreContextOnBackgroundEndpoint,
  dispatchJSContextOnMainThreadEndpoint,
  type Rpc,
  type StartMainThreadContextConfig,
  LynxCrossThreadContext,
  type RpcCallType,
  type reportErrorEndpoint,
  switchExposureServiceEndpoint,
  type I18nResourceTranslationOptions,
  getCacheI18nResourcesKey,
  type InitI18nResources,
  type I18nResources,
  dispatchI18nResourceEndpoint,
  type Cloneable,
  type SSRHydrateInfo,
  type SSRDehydrateHooks,
  type JSRealm,
  type MainThreadGlobalThis,
  type TemplateLoader,
} from '@lynx-js/web-constants';
import { registerCallLepusMethodHandler } from './crossThreadHandlers/registerCallLepusMethodHandler.js';
import { registerGetCustomSectionHandler } from './crossThreadHandlers/registerGetCustomSectionHandler.js';
import { createMainThreadGlobalThis } from './createMainThreadGlobalThis.js';
import { createExposureService } from './utils/createExposureService.js';
import { initWasm } from '@lynx-js/web-style-transformer';
import { appendStyleElement } from './utils/processStyleInfo.js';
import { createQueryComponent } from './crossThreadHandlers/createQueryComponent.js';
const initWasmPromise = initWasm();

export function prepareMainThreadAPIs(
  backgroundThreadRpc: Rpc,
  rootDom: Document | ShadowRoot,
  document: Document,
  mtsRealm: JSRealm,
  commitDocument: (
    exposureChangedElements: HTMLElement[],
  ) => Promise<void> | void,
  markTimingInternal: (timingKey: string, pipelineId?: string) => void,
  flushMarkTimingInternal: () => void,
  reportError: RpcCallType<typeof reportErrorEndpoint>,
  triggerI18nResourceFallback: (
    options: I18nResourceTranslationOptions,
  ) => void,
  initialI18nResources: (data: InitI18nResources) => I18nResources,
  loadTemplate: TemplateLoader,
  ssrHooks?: SSRDehydrateHooks,
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
  const dispatchI18nResource = backgroundThreadRpc.createCall(
    dispatchI18nResourceEndpoint,
  );
  markTimingInternal('lepus_execute_start');
  async function startMainThread(
    config: StartMainThreadContextConfig,
    ssrHydrateInfo?: SSRHydrateInfo,
  ): Promise<void> {
    let isFp = true;
    const {
      globalProps,
      template,
      browserConfig,
      nativeModulesMap,
      napiModulesMap,
      tagMap,
      initI18nResources,
    } = config;
    const {
      styleInfo,
      pageConfig,
      customSections,
      cardType,
    } = template;
    markTimingInternal('decode_start');
    await initWasmPromise;
    const jsContext = new LynxCrossThreadContext({
      rpc: backgroundThreadRpc,
      receiveEventEndpoint: dispatchJSContextOnMainThreadEndpoint,
      sendEventEndpoint: dispatchCoreContextOnBackgroundEndpoint,
    });
    const i18nResources = initialI18nResources(initI18nResources);

    const { updateCssOGStyle, updateLazyComponentStyle } = appendStyleElement(
      styleInfo,
      pageConfig,
      rootDom as unknown as Node,
      document,
      ssrHydrateInfo,
    );
    const mtsGlobalThisRef: { mtsGlobalThis: MainThreadGlobalThis } = {
      mtsGlobalThis: undefined as unknown as MainThreadGlobalThis,
    };
    const __QueryComponent = createQueryComponent(
      loadTemplate,
      updateLazyComponentStyle,
      backgroundThreadRpc,
      mtsGlobalThisRef,
      jsContext,
      mtsRealm,
    );
    const mtsGlobalThis = createMainThreadGlobalThis({
      lynxTemplate: template,
      mtsRealm,
      jsContext,
      tagMap,
      browserConfig,
      globalProps,
      pageConfig,
      rootDom,
      ssrHydrateInfo,
      ssrHooks,
      document,
      callbacks: {
        updateCssOGStyle,
        mainChunkReady: () => {
          markTimingInternal('data_processor_start');
          let initData = config.initData;
          if (
            pageConfig.enableJSDataProcessor !== true
            && mtsGlobalThis.processData
          ) {
            initData = mtsGlobalThis.processData(config.initData);
          }
          markTimingInternal('data_processor_end');
          registerCallLepusMethodHandler(
            backgroundThreadRpc,
            mtsGlobalThis,
          );
          registerGetCustomSectionHandler(
            backgroundThreadRpc,
            customSections,
          );
          const { switchExposureService } = createExposureService(
            rootDom,
            postExposure,
          );
          backgroundThreadRpc.registerHandler(
            switchExposureServiceEndpoint,
            switchExposureService,
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
          if (!ssrHydrateInfo) {
            mtsGlobalThis.renderPage!(initData);
            mtsGlobalThis.__FlushElementTree(undefined, {});
          } else {
            // replay the hydrate event
            for (const event of ssrHydrateInfo.events) {
              const uniqueId = event[0];
              const element = ssrHydrateInfo.lynxUniqueIdToElement[uniqueId]
                ?.deref();
              if (element) {
                mtsGlobalThis.__AddEvent(element, event[1], event[2], event[3]);
              }
            }
            mtsGlobalThis.ssrHydrate?.(ssrHydrateInfo.ssrEncodeData);
          }
        },
        flushElementTree: async (
          options,
          timingFlags,
          exposureChangedElements,
        ) => {
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
          await commitDocument(
            exposureChangedElements as unknown as HTMLElement[],
          );
          markTimingInternal('ui_operation_flush_end', pipelineId);
          markTimingInternal('layout_end', pipelineId);
          markTimingInternal('dispatch_end', pipelineId);
          flushMarkTimingInternal();
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
        _I18nResourceTranslation: (options: I18nResourceTranslationOptions) => {
          const matchedInitI18nResources = i18nResources.data?.find(i =>
            getCacheI18nResourcesKey(i.options)
              === getCacheI18nResourcesKey(options)
          );
          dispatchI18nResource(matchedInitI18nResources?.resource as Cloneable);
          if (matchedInitI18nResources) {
            return matchedInitI18nResources.resource;
          }
          return triggerI18nResourceFallback(options);
        },
        __QueryComponent,
      },
    });
    mtsGlobalThisRef.mtsGlobalThis = mtsGlobalThis;
    markTimingInternal('decode_end');
    await mtsRealm.loadScript(template.lepusCode.root);
    jsContext.__start(); // start the jsContext after the runtime is created
  }
  return { startMainThread };
}
