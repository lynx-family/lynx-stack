// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { componentIdAttribute, lynxTagAttribute } from '@lynx-js/web-constants';
import {
  type ElementThreadElement,
  type ComponentAtIndexCallback,
  type EnqueueComponentCallback,
  type ListElement,
  RefCountType,
} from '../ElementThreadElement.js';

export function __AddConfig(
  element: ElementThreadElement,
  type: string,
  value: any,
) {
  element.property.componentConfig[type] = value;
}

export function __AddDataset(
  element: ElementThreadElement,
  key: string,
  value: string | number | Record<string, any>,
): void {
  element.setDatasetProperty(key, value);
}

export function __GetAttributes(element: ElementThreadElement) {
  return element.attributes;
}

export function __GetComponentID(element: ElementThreadElement) {
  return element.attributes[componentIdAttribute];
}

export function __GetDataByKey(
  element: ElementThreadElement,
  key: string,
) {
  return element.property.dataset[key];
}

export function __GetDataset(
  element: ElementThreadElement,
): Record<string, any> {
  return element.property.dataset;
}

export function __GetElementConfig(
  element: ElementThreadElement,
) {
  return element.property.componentConfig;
}

export function __GetElementUniqueID(
  element: ElementThreadElement | unknown,
): number {
  if (
    element && typeof element === 'object'
    && (element as ElementThreadElement).type === RefCountType.Element
  ) {
    return (element as ElementThreadElement).uniqueId;
  }
  return -1;
}

export function __GetID(element: ElementThreadElement): string {
  return element.attributes.id ?? '';
}

export function __GetTag(element: ElementThreadElement): string {
  return element.getAttribute(lynxTagAttribute)!;
}

export function __SetConfig(
  element: ElementThreadElement,
  config: Record<string, any>,
): void {
  element.property.componentConfig = config;
}

export function __SetDataset(
  element: ElementThreadElement,
  dataset: Record<string, any>,
): void {
  element.setProperty('dataset', dataset);
}

export function __SetID(element: ElementThreadElement, id: string) {
  element.setAttribute('id', id);
}

export function __UpdateComponentID(
  element: ElementThreadElement,
  componentID: string,
) {
  element.setAttribute(componentIdAttribute, componentID);
}

export function __GetConfig(
  element: ElementThreadElement,
) {
  return element.property.componentConfig;
}

export function __UpdateListCallbacks(
  list: ListElement,
  componentAtIndex: ComponentAtIndexCallback,
  enqueueComponent: EnqueueComponentCallback,
) {
  list.componentAtIndex = componentAtIndex;
  list.enqueueComponent = enqueueComponent;
}
