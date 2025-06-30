// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LynxView } from '../apis/createLynxView.js';
import { bootWorkers } from './bootWorkers.js';
import { createDispose } from './crossThreadHandlers/createDispose.js';
import {
  type LynxTemplate,
  type StartMainThreadContextConfig,
  type NapiModulesCall,
  type NativeModulesCall,
  updateGlobalPropsEndpoint,
  type Cloneable,
  dispatchMarkTiming,
  flushMarkTiming,
} from '@lynx-js/web-constants';
import { loadTemplate } from '../utils/loadTemplate.js';
import { createUpdateData } from './crossThreadHandlers/createUpdateData.js';
import { startBackground } from './startBackground.js';
import { createRenderMultiThread } from './createRenderMultiThread.js';
import { createRenderAllOnUI } from './createRenderAllOnUI.js';

export type StartUIThreadCallbacks = {
  nativeModulesCall: NativeModulesCall;
  napiModulesCall: NapiModulesCall;
  onError?: (err: Error, release: string) => void;
  customTemplateLoader?: (url: string) => Promise<LynxTemplate>;
};

export function startUIThread(
  templateUrl: string,
  configs: Omit<StartMainThreadContextConfig, 'template'>,
  shadowRoot: ShadowRoot,
  lynxGroupId: number | undefined,
  threadStrategy: 'all-on-ui' | 'multi-thread',
  callbacks: StartUIThreadCallbacks,
): LynxView {
  const createLynxStartTiming = performance.now() + performance.timeOrigin;
  const allOnUI = threadStrategy === 'all-on-ui';
  const {
    mainThreadRpc,
    backgroundRpc,
    terminateWorkers,
  } = bootWorkers(lynxGroupId, allOnUI);
  const {
    markTiming,
    sendGlobalEvent,
    updateDataBackground,
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
  const markTimingInternal = (
    timingKey: string,
    pipelineId?: string,
    timeStamp?: number,
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
  const { start, updateDataMainThread, updateI18nResourcesMainThread } = allOnUI
    ? createRenderAllOnUI(
      /* main-to-bg rpc*/ mainThreadRpc,
      shadowRoot,
      markTimingInternal,
      flushMarkTimingInternal,
      callbacks,
    )
    : createRenderMultiThread(
      /* main-to-ui rpc*/ mainThreadRpc,
      shadowRoot,
      callbacks,
    );
  markTimingInternal('create_lynx_start', undefined, createLynxStartTiming);
  markTimingInternal('load_template_start');
  loadTemplate(templateUrl, callbacks.customTemplateLoader).then((template) => {
    markTimingInternal('load_template_end');
    flushMarkTimingInternal();
    start({
      ...configs,
      template,
    });
  });
  return {
    updateData: createUpdateData(updateDataMainThread, updateDataBackground),
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
