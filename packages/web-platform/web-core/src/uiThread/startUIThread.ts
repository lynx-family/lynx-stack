// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LynxView } from '../apis/createLynxView.js';
import { bootWorkers } from './bootWorkers.js';
import { createDispose } from './crossThreadHandlers/createDispose.js';
import {
  type LynxTemplate,
  type MainThreadStartConfigs,
  type NapiModulesCall,
  type NativeModulesCall,
} from '@lynx-js/web-constants';
import { loadTemplate } from '../utils/loadTemplate.js';
import { createUpdateData } from './crossThreadHandlers/createUpdateData.js';
import { startBackground } from './startBackground.js';
import { createRenderMultiThread } from './createRenderMultiThread.js';
import { createRenderAllOnUI } from './createRenderAllOnUI.js';

export type StartUIThreadCallbacks = {
  nativeModulesCall: NativeModulesCall;
  napiModulesCall: NapiModulesCall;
  onError?: () => void;
  customTemplateLoader?: (url: string) => Promise<LynxTemplate>;
};

export function startUIThread(
  templateUrl: string,
  configs: Omit<MainThreadStartConfigs, 'template'>,
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
  const { markTiming, sendGlobalEvent, updateDataBackground } = startBackground(
    backgroundRpc,
    shadowRoot,
    callbacks,
  );
  const markTimingInternal = (
    timingKey: string,
    pipelineId?: string,
    timeStamp?: number,
  ) => {
    if (!timeStamp) timeStamp = performance.now() + performance.timeOrigin;
    markTiming(timingKey, pipelineId, timeStamp);
  };
  const { start, updateDataMainThread } = allOnUI
    ? createRenderAllOnUI(
      /* main-to-bg rpc*/ mainThreadRpc,
      shadowRoot,
      markTimingInternal,
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
  };
}
