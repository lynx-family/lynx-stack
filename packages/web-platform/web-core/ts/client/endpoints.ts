// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRpcEndpoint } from '@lynx-js/web-worker-rpc';
import type {
  Cloneable,
  CloneableObject,
  LynxCrossThreadEvent,
  InvokeCallbackRes,
  ElementAnimationOptions,
  UpdateDataOptions,
  TimingEntry,
} from '../types/index.js';
import type { IdentifierType } from '../constants.js';

export const publicComponentEventEndpoint = createRpcEndpoint<
  [componentId: string, hname: string, LynxCrossThreadEvent],
  void
>('publicComponentEvent', false, false);

export const publishEventEndpoint = createRpcEndpoint<
  [string, LynxCrossThreadEvent],
  void
>('publishEvent', false, false);

export const switchExposureServiceEndpoint = createRpcEndpoint<
  [boolean, boolean],
  void
>(
  'switchExposureServiceEndpoint',
  false,
  false,
);

export const updateDataEndpoint = createRpcEndpoint<
  [Cloneable, UpdateDataOptions | undefined],
  void
>('updateData', false, true);

export const sendGlobalEventEndpoint = createRpcEndpoint<
  [string, Cloneable[] | undefined],
  void
>('sendGlobalEventEndpoint', false, false);

export const disposeEndpoint = createRpcEndpoint<
  [],
  void
>('dispose', false, true);

export const BackgroundThreadStartEndpoint = createRpcEndpoint<[], void>(
  'start',
  false,
  true,
);

/**
 * Error message, info
 */
export const reportErrorEndpoint = createRpcEndpoint<
  [Error, unknown, string],
  void
>('reportError', false, false);

export const callLepusMethodEndpoint = createRpcEndpoint<
  [name: string, data: unknown],
  void
>('callLepusMethod', false, true);

export const invokeUIMethodEndpoint = createRpcEndpoint<
  [
    type: IdentifierType,
    identifier: string,
    component_id: string,
    method: string,
    params: object,
    root_unique_id: number | undefined,
  ],
  InvokeCallbackRes
>('__invokeUIMethod', false, true);

export const setNativePropsEndpoint = createRpcEndpoint<
  [
    type: IdentifierType,
    identifier: string,
    component_id: string,
    first_only: boolean,
    native_props: object,
    root_unique_id: number | undefined,
  ],
  void
>('__setNativeProps', false, true);

export const getPathInfoEndpoint = createRpcEndpoint<
  [
    type: IdentifierType,
    identifier: string,
    component_id: string,
    first_only: boolean,
    root_unique_id?: number | undefined,
  ],
  InvokeCallbackRes
>('__getPathInfo', false, true);

export const nativeModulesCallEndpoint = createRpcEndpoint<
  [name: string, data: Cloneable, moduleName: string],
  any
>('nativeModulesCall', false, true);

export const napiModulesCallEndpoint = createRpcEndpoint<
  [name: string, data: Cloneable, moduleName: string],
  any
>('napiModulesCall', false, true, true);

export const getCustomSectionsEndpoint = createRpcEndpoint<
  [string],
  Cloneable
>('getCustomSections', false, true);

export const markTimingEndpoint = createRpcEndpoint<
  [TimingEntry[]],
  void
>('markTiming', false, false);

export const postTimingFlagsEndpoint = createRpcEndpoint<
  [
    timingFlags: string[],
    pipelineId: string | undefined,
  ],
  void
>('postTimingFlags', false, false);

export const triggerComponentEventEndpoint = createRpcEndpoint<
  [
    id: string,
    params: {
      eventDetail: CloneableObject;
      eventOption: CloneableObject;
      componentId: string;
    },
  ],
  void
>('__triggerComponentEvent', false, false);

export const selectComponentEndpoint = createRpcEndpoint<
  [
    componentId: string,
    idSelector: string,
    single: boolean,
  ],
  void
>('__selectComponent', false, true);

export const dispatchLynxViewEventEndpoint = createRpcEndpoint<
  [
    eventType: string,
    detail: CloneableObject,
  ],
  void
>('dispatchLynxViewEvent', false, false);

export const dispatchNapiModuleEndpoint = createRpcEndpoint<
  [data: Cloneable],
  void
>('dispatchNapiModule', false, false);
export const dispatchCoreContextOnBackgroundEndpoint = createRpcEndpoint<
  [{
    type: string;
    data: Cloneable;
  }],
  void
>('dispatchCoreContextOnBackground', false, false);

export const dispatchJSContextOnMainThreadEndpoint = createRpcEndpoint<
  [{
    type: string;
    data: Cloneable;
  }],
  void
>('dispatchJSContextOnMainThread', false, false);

export const triggerElementMethodEndpoint = createRpcEndpoint<
  [
    method: string,
    id: string,
    options: ElementAnimationOptions,
  ],
  void
>('__triggerElementMethod', false, false);

export const updateGlobalPropsEndpoint = createRpcEndpoint<
  [Cloneable],
  void
>('updateGlobalProps', false, false);

export const updateI18nResourcesEndpoint = createRpcEndpoint<
  [Cloneable],
  void
>('updateI18nResources', false, false);

export const dispatchI18nResourceEndpoint = createRpcEndpoint<
  [Cloneable],
  void
>('dispatchI18nResource', false, false);

export const queryComponentEndpoint = createRpcEndpoint<
  [string],
  { code: number; detail: { schema: string } }
>('queryComponent', false, true);

export const updateBTSChunkEndpoint = createRpcEndpoint<
  [/** url */ string, Record<string, string>],
  void
>('updateBTSChunkEndpoint', false, true);

export const reloadEndpoint = createRpcEndpoint<
  [],
  void
>('reload', false, false);
