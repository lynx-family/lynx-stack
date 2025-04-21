// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LynxView } from '../apis/createLynxView.js';
import { registerInvokeUIMethodHandler } from './crossThreadHandlers/registerInvokeUIMethodHandler.js';
import { registerNativePropsHandler } from './crossThreadHandlers/registerSetNativePropsHandler.js';
import { registerNativeModulesCallHandler } from './crossThreadHandlers/registerNativeModulesCallHandler.js';
import { bootWorkers } from './bootWorkers.js';
import { registerReportErrorHandler } from './crossThreadHandlers/registerReportErrorHandler.js';
import { registerFlushElementTreeHandler } from './crossThreadHandlers/registerFlushElementTreeHandler.js';
import { createDispose } from './crossThreadHandlers/createDispose.js';
import { registerTriggerComponentEventHandler } from './crossThreadHandlers/registerTriggerComponentEventHandler.js';
import { registerSelectComponentHandler } from './crossThreadHandlers/registerSelectComponentHandler.js';
import {
  mainThreadStartEndpoint,
  markTimingEndpoint,
  sendGlobalEventEndpoint,
  type LynxTemplate,
  type MainThreadStartConfigs,
  type NapiModulesCall,
  type NativeModulesCall,
} from '@lynx-js/web-constants';
import { loadTemplate } from '../utils/loadTemplate.js';
import { createUpdateData } from './crossThreadHandlers/createUpdateData.js';
import { registerNapiModulesCallHandler } from './crossThreadHandlers/registerNapiModulesCallHandler.js';
import { registerDispatchLynxViewEventHandler } from './crossThreadHandlers/registerDispatchLynxViewEventHandler.js';

export function startUIThread(
  templateUrl: string,
  configs: Omit<MainThreadStartConfigs, 'template'>,
  shadowRoot: ShadowRoot,
  lynxGroupId: number | undefined,
  callbacks: {
    nativeModulesCall: NativeModulesCall;
    napiModulesCall: NapiModulesCall;
    onError?: () => void;
    customTemplateLoader?: (url: string) => Promise<LynxTemplate>;
  },
): LynxView {
  const createLynxStartTiming = performance.now() + performance.timeOrigin;
  const {
    mainThreadRpc,
    backgroundRpc,
    terminateWorkers,
  } = bootWorkers(lynxGroupId);
  const sendGlobalEvent = backgroundRpc.createCall(sendGlobalEventEndpoint);
  const mainThreadStart = mainThreadRpc.createCall(mainThreadStartEndpoint);
  const markTiming = backgroundRpc.createCall(markTimingEndpoint);
  const markTimingInternal = (
    timingKey: string,
    pipelineId?: string,
    timeStamp?: number,
  ) => {
    if (!timeStamp) timeStamp = performance.now() + performance.timeOrigin;
    markTiming(timingKey, pipelineId, timeStamp);
  };
  markTimingInternal('create_lynx_start', undefined, createLynxStartTiming);
  markTimingInternal('load_template_start');
  loadTemplate(templateUrl, callbacks.customTemplateLoader).then((template) => {
    markTimingInternal('load_template_end');
    mainThreadStart({
      ...configs,
      template,
    });
  });
  registerReportErrorHandler(
    mainThreadRpc,
    callbacks.onError,
  );
  registerDispatchLynxViewEventHandler(backgroundRpc, shadowRoot);
  registerFlushElementTreeHandler(
    mainThreadRpc,
    {
      shadowRoot,
    },
  );
  registerInvokeUIMethodHandler(
    backgroundRpc,
    shadowRoot,
  );
  registerNativePropsHandler(
    backgroundRpc,
    shadowRoot,
  );
  registerTriggerComponentEventHandler(
    backgroundRpc,
    shadowRoot,
  );
  registerSelectComponentHandler(
    backgroundRpc,
    shadowRoot,
  );
  registerNativeModulesCallHandler(
    backgroundRpc,
    callbacks.nativeModulesCall,
  );
  registerNapiModulesCallHandler(
    backgroundRpc,
    callbacks.napiModulesCall,
  );
  return {
    updateData: createUpdateData(mainThreadRpc, backgroundRpc),
    dispose: createDispose(
      backgroundRpc,
      terminateWorkers,
    ),
    sendGlobalEvent,
  };
}
