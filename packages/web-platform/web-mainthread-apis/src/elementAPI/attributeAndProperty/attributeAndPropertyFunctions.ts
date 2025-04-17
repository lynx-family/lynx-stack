// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  __lynx_timing_flag,
  componentIdAttribute,
  lynxTagAttribute,
} from '@lynx-js/web-constants';
import {
  type ComponentAtIndexCallback,
  type EnqueueComponentCallback,
} from '../ElementThreadElement.js';
import {
  elementToRuntimeInfoMap,
  type MainThreadRuntime,
} from '../../MainThreadRuntime.js';

function setDatasetAttribute(
  element: HTMLElement,
  key: string,
  value: string | number | Record<string, any>,
): void {
  if (value !== null && value !== undefined) {
    if (typeof value === 'object') {
      element.setAttribute('data-' + key, JSON.stringify(value));
    } else {
      element.setAttribute('data-' + key, value.toString());
    }
  }
}
type UpdateListInfoAttributeValue = {
  insertAction: {
    position: number;
  }[];
  removeAction: {
    position: number;
  }[];
};

export function createAttributeAndPropertyFunctions(
  runtime: MainThreadRuntime,
) {
  function __AddConfig(
    element: HTMLElement,
    type: string,
    value: any,
  ) {
    runtime[elementToRuntimeInfoMap].get(element)!.componentConfig[type] =
      value;
  }

  function __AddDataset(
    element: HTMLElement,
    key: string,
    value: string | number | Record<string, any>,
  ): void {
    runtime[elementToRuntimeInfoMap].get(element)!.lynxDataset[key] = value;
    setDatasetAttribute(element, key, value);
  }

  function __GetAttributes(
    element: HTMLElement,
  ): Record<string, string | null> {
    return Object.fromEntries(
      element.getAttributeNames().map((
        attributeName,
      ) => [attributeName, element.getAttribute(attributeName)]),
    );
  }

  function __GetComponentID(element: HTMLElement): string | null {
    return element.getAttribute(componentIdAttribute);
  }

  function __GetDataByKey(
    element: HTMLElement,
    key: string,
  ) {
    return runtime[elementToRuntimeInfoMap].get(element)!.lynxDataset[key];
  }

  function __GetDataset(
    element: HTMLElement,
  ): Record<string, any> {
    return runtime[elementToRuntimeInfoMap].get(element)!.lynxDataset;
  }

  function __GetElementConfig(
    element: HTMLElement,
  ) {
    return runtime[elementToRuntimeInfoMap].get(element)!.componentConfig;
  }

  function __GetElementUniqueID(
    element: HTMLElement,
  ): number {
    return runtime[elementToRuntimeInfoMap].get(element)?.uniqueId ?? -1;
  }

  function __GetID(element: HTMLElement): string {
    return element.id;
  }

  function __GetTag(element: HTMLElement): string {
    return element.getAttribute(lynxTagAttribute)!;
  }

  function __SetConfig(
    element: HTMLElement,
    config: Record<string, any>,
  ): void {
    runtime[elementToRuntimeInfoMap].get(element)!.componentConfig = config;
  }

  function __SetDataset(
    element: HTMLElement,
    dataset: Record<string, any>,
  ): void {
    runtime[elementToRuntimeInfoMap].get(element)!.lynxDataset = dataset;
    for (const [key, value] of Object.entries(dataset)) {
      setDatasetAttribute(element, key, value);
    }
  }

  function __SetID(element: HTMLElement, id: string | null) {
    if (typeof id === 'string') {
      element.id = id;
    } else {
      element.removeAttribute('id');
    }
  }

  function __UpdateComponentID(
    element: HTMLElement,
    componentID: string,
  ) {
    element.setAttribute(componentIdAttribute, componentID);
  }

  function __GetConfig(
    element: HTMLElement,
  ) {
    return runtime[elementToRuntimeInfoMap].get(element)!.componentConfig;
  }

  function __UpdateListCallbacks(
    element: HTMLElement,
    componentAtIndex: ComponentAtIndexCallback,
    enqueueComponent: EnqueueComponentCallback,
  ) {
    runtime[elementToRuntimeInfoMap].get(element)!.componentAtIndex =
      componentAtIndex;
    runtime[elementToRuntimeInfoMap].get(element)!.enqueueComponent =
      enqueueComponent;
  }

  function __SetAttribute(
    element: HTMLElement,
    key: string,
    value: string | null | undefined | UpdateListInfoAttributeValue,
  ): void {
    if (value === null || value === undefined) {
      element.removeAttribute(key);
    } else {
      if (__GetTag(element) === 'list' && key === 'update-list-info') {
        const listInfo = value as UpdateListInfoAttributeValue;
        const { insertAction, removeAction } = listInfo;
        queueMicrotask(() => {
          const runtimeInfo = runtime[elementToRuntimeInfoMap].get(element)!;
          const componentAtIndex = runtimeInfo.componentAtIndex;
          const enqueueComponent = runtimeInfo.enqueueComponent;
          for (const action of insertAction) {
            componentAtIndex?.(
              element,
              runtimeInfo.uniqueId,
              action.position,
              0,
              false,
            );
          }
          for (const action of removeAction) {
            enqueueComponent?.(element, runtimeInfo.uniqueId, action.position);
          }
        });
      } else {
        element.setAttribute(key, value.toString());
      }
    }
    if (key === __lynx_timing_flag && value) {
      runtime._timingFlags.push(value as string);
    }
  }

  return {
    __AddConfig,
    __AddDataset,
    __GetAttributes,
    __GetComponentID,
    __GetDataByKey,
    __GetDataset,
    __GetElementConfig,
    __GetElementUniqueID,
    __GetID,
    __GetTag,
    __SetConfig,
    __SetDataset,
    __SetID,
    __UpdateComponentID,
    __UpdateListCallbacks,
    __GetConfig,
    __SetAttribute,
  };
}
