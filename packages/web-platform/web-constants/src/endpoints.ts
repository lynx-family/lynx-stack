// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRpcEndpoint } from '@lynx-js/web-worker-rpc';
import type {
  ExposureWorkerEvent,
  LynxCrossThreadEvent,
} from './types/EventType.js';
import type { Cloneable, CloneableObject } from './types/Cloneable.js';
import type { StartMainThreadContextConfig } from './types/MainThreadStartConfigs.js';
import type { IdentifierType, InvokeCallbackRes } from './types/NativeApp.js';
import type { ElementAnimationOptions } from './types/Element.js';
import type {
  BackMainThreadContextConfig,
  LynxTemplate,
  MarkTiming,
} from './types/index.js';
import type { UpdateDataOptions } from './types/UpdateDataOptions.js';

export const postExposureEndpoint = createRpcEndpoint<
  [{ exposures: ExposureWorkerEvent[]; disExposures: ExposureWorkerEvent[] }],
  void
>(
  '__postExposure',
  false,
  false,
);

export const publicComponentEventEndpoint = createRpcEndpoint<
  [componentId: string, hname: string, LynxCrossThreadEvent],
  void
>('publicComponentEvent', false, false);

export const publishEventEndpoint = createRpcEndpoint<
  [string, LynxCrossThreadEvent],
  void
>('publishEvent', false, false);

export const postOffscreenEventEndpoint = createRpcEndpoint<
  [
    eventType: string,
    targetUniqueId: number,
    bubbles: boolean,
    Parameters<typeof structuredClone>[0],
  ],
  void
>('postOffscreenEventEndpoint', false, false);

export const switchExposureServiceEndpoint = createRpcEndpoint<
  [boolean, boolean],
  void
>(
  'switchExposureServiceEndpoint',
  false,
  false,
);

export const mainThreadStartEndpoint = createRpcEndpoint<
  [StartMainThreadContextConfig],
  void
>('mainThreadStart', false, false);

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

export const BackgroundThreadStartEndpoint = createRpcEndpoint<[
  BackMainThreadContextConfig,
], void>('start', false, true);

/**
 * Error message, info
 */
export const reportErrorEndpoint = createRpcEndpoint<
  [Error, unknown, string],
  void
>('reportError', false, false);

export const flushElementTreeEndpoint = createRpcEndpoint<
  [
    operations: (string | number)[],
  ],
  void
>('flushElementTree', false, true);

export const callLepusMethodEndpoint = createRpcEndpoint<
  [name: string, data: unknown],
  void
>('callLepusMethod', false, true);

export const multiThreadExposureChangedEndpoint = createRpcEndpoint<
  [string[]],
  void
>('multiThreadExposureChangedEndpoint', false, false);

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
  [MarkTiming[]],
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

export const updateI18nResourceEndpoint = createRpcEndpoint<
  [Cloneable | undefined],
  void
>('updateI18nResource', false, false);

export const dispatchI18nResourceEndpoint = createRpcEndpoint<
  [Cloneable],
  void
>('dispatchI18nResource', false, false);

export const queryComponentEndpoint = createRpcEndpoint<
  [string],
  { code: number; detail: { schema: string } }
>('queryComponent', false, true);

export const updateBTSTemplateCacheEndpoint = createRpcEndpoint<
  [/** url */ string, LynxTemplate],
  void
>('updateBTSTemplateCacheEndpoint', false, true);

export const loadTemplateMultiThread = createRpcEndpoint<
  [string],
  LynxTemplate
>('loadTemplateMultiThread', false, true);

export const reloadEndpoint = createRpcEndpoint<
  [],
  void
>('reload', false, false);
