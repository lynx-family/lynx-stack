// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  __lynx_timing_flag,
  componentIdAttribute,
  lynxComponentConfigAttribute,
  lynxDatasetAttribute,
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
    const currentComponentConfigString = element.getAttribute(
      lynxComponentConfigAttribute,
    );
    let currentComponentConfig: Record<string, any> =
      currentComponentConfigString
        ? JSON.parse(decodeURIComponent(currentComponentConfigString))
        : {};
    currentComponentConfig[type] = value;
    element.setAttribute(
      lynxComponentConfigAttribute,
      encodeURIComponent(JSON.stringify(currentComponentConfig)),
    );
  }

  function __AddDataset(
    element: HTMLElement,
    key: string,
    value: string | number | Record<string, any>,
  ): void {
    const currentDataset = __GetDataset(element);
    currentDataset[key] = value;
    element.setAttribute(
      lynxDatasetAttribute,
      encodeURIComponent(JSON.stringify(currentDataset)),
    );
    element.setAttribute('data-' + key, value.toString());
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
    const dataset = __GetDataset(element);
    return dataset[key];
  }

  function __GetDataset(
    element: HTMLElement,
  ): Record<string, any> {
    const datasetString = element.getAttribute(lynxDatasetAttribute);
    const currentDataset: Record<string, any> = datasetString
      ? JSON.parse(decodeURIComponent(datasetString))
      : {};
    return currentDataset;
  }

  function __GetElementConfig(
    element: HTMLElement,
  ) {
    const currentComponentConfigString = element.getAttribute(
      lynxComponentConfigAttribute,
    );
    return currentComponentConfigString
      ? JSON.parse(decodeURIComponent(currentComponentConfigString))
      : {};
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
    element.setAttribute(
      lynxComponentConfigAttribute,
      encodeURIComponent(JSON.stringify(config)),
    );
  }

  function __SetDataset(
    element: HTMLElement,
    dataset: Record<string, any>,
  ): void {
    element.setAttribute(
      lynxDatasetAttribute,
      encodeURIComponent(JSON.stringify(dataset)),
    );
    for (const [key, value] of Object.entries(dataset)) {
      element.setAttribute('data-' + key, value.toString());
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
    __GetConfig: __GetElementConfig,
    __SetAttribute,
  };
}
