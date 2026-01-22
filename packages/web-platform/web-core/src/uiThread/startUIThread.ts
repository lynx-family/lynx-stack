// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LynxView } from '../apis/createLynxView.js';
import { bootWorkers } from './bootWorkers.js';
import { createDispose } from './crossThreadHandlers/createDispose.js';
import {
  type StartMainThreadContextConfig,
  type NapiModulesCall,
  type NativeModulesCall,
  updateGlobalPropsEndpoint,
  type Cloneable,
  dispatchMarkTiming,
  flushMarkTiming,
  type SSRDumpInfo,
  type TemplateLoader,
  type MarkTimingInternal,
} from '@lynx-js/web-constants';
import { createTemplateLoader } from '../utils/loadTemplate.js';
import { createUpdateData } from './crossThreadHandlers/createUpdateData.js';
import { startBackground } from './startBackground.js';
import { createRenderMultiThread } from './createRenderMultiThread.js';
import { createRenderAllOnUI } from './createRenderAllOnUI.js';

export type StartUIThreadCallbacks = {
  nativeModulesCall: NativeModulesCall;
  napiModulesCall: NapiModulesCall;
  onError?: (err: Error, release: string, fileName: string) => void;
  customTemplateLoader?: TemplateLoader;
  reload: () => void;
};

export function startUIThread(
  templateUrl: string,
  configs: Omit<StartMainThreadContextConfig, 'template'>,
  shadowRoot: ShadowRoot,
  lynxGroupId: number | undefined,
  threadStrategy: 'all-on-ui' | 'multi-thread',
  callbacks: StartUIThreadCallbacks,
  ssr?: SSRDumpInfo,
): LynxView {
  const createLynxStartTiming = performance.now() + performance.timeOrigin;
  const allOnUI = threadStrategy === 'all-on-ui';
  const {
    mainThreadRpc,
    backgroundRpc,
    terminateWorkers,
  } = bootWorkers(lynxGroupId, allOnUI, configs.browserConfig);
  const {
    markTiming,
    sendGlobalEvent,
    updateI18nResourceBackground,
  } = startBackground(
    backgroundRpc,
    shadowRoot,
    callbacks,
  );
  const cacheMarkTimings = {
    records: [],
    timeout: null,
  };
  const markTimingInternal: MarkTimingInternal = (
    timingKey,
    pipelineId,
    timeStamp,
  ) => {
    dispatchMarkTiming({
      timingKey,
      pipelineId,
      timeStamp,
      markTiming,
      cacheMarkTimings,
    });
  };
  const flushMarkTimingInternal = () =>
    flushMarkTiming(markTiming, cacheMarkTimings);
  const templateLoader = createTemplateLoader(
    callbacks.customTemplateLoader,
    markTimingInternal,
  );
  const { start, updateDataMainThread, updateI18nResourcesMainThread } = allOnUI
    ? createRenderAllOnUI(
      /* main-to-bg rpc*/ mainThreadRpc,
      shadowRoot,
      templateLoader,
      markTimingInternal,
      flushMarkTimingInternal,
      callbacks,
      ssr,
    )
    : createRenderMultiThread(
      /* main-to-ui rpc*/ mainThreadRpc,
      shadowRoot,
      templateLoader,
      callbacks,
    );
  markTimingInternal('create_lynx_start', undefined, createLynxStartTiming);
  templateLoader(templateUrl).then((template) => {
    flushMarkTimingInternal();
    start({
      ...configs,
      template,
    });
  });
  return {
    updateData: createUpdateData(updateDataMainThread),
    dispose: createDispose(
      backgroundRpc,
      terminateWorkers,
    ),
    sendGlobalEvent,
    updateGlobalProps: backgroundRpc.createCall(updateGlobalPropsEndpoint),
    updateI18nResources: (...args) => {
      updateI18nResourcesMainThread(args[0] as Cloneable);
      updateI18nResourceBackground(...args);
    },
  };
}
