/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import { uniqueIdSymbol } from '../../constants.js';
import type {
  AddConfigPAPI,
  AddDatasetPAPI,
  AddEventPAPI,
  Cloneable,
  ElementIsEqualPAPI,
  FirstElementPAPI,
  GetChildrenPAPI,
  GetComponentIdPAPI,
  GetDataByKeyPAPI,
  GetDatasetPAPI,
  GetElementConfigPAPI,
  GetElementUniqueIDPAPI,
  GetEventPAPI,
  GetEventsPAPI,
  GetPageElementPAPI,
  GetParentPAPI,
  GetTemplatePartsPAPI,
  InsertElementBeforePAPI,
  LastElementPAPI,
  MarkPartElementPAPI,
  MarkTemplateElementPAPI,
  NextElementPAPI,
  RemoveElementPAPI,
  ReplaceElementPAPI,
  ReplaceElementsPAPI,
  SetConfigPAPI,
  SetDatasetPAPI,
  SetEventsPAPI,
  SwapElementPAPI,
  UpdateComponentIDPAPI,
  UpdateComponentInfoPAPI,
  UpdateListCallbacksPAPI,
} from '../../types/index.js';

export interface ServerElement {
  [uniqueIdSymbol]: number;
  tagName: string;
  attributes: Record<string, string>;
}

export function getUniqueId(element: unknown): number {
  return (element as ServerElement)[uniqueIdSymbol];
}

export const __ElementIsEqual: ElementIsEqualPAPI = (
  left: HTMLElement | null,
  right: HTMLElement | null,
) => {
  if (left === right) return true;
  if (!left || !right) return false;
  return getUniqueId(left) === getUniqueId(right);
};

export const __GetElementUniqueID: GetElementUniqueIDPAPI = (
  element: HTMLElement,
) => {
  return getUniqueId(element);
};

// Throwing/Stub Implementations
export const __GetParent: GetParentPAPI = (_element: HTMLElement) => {
  throw new Error('__GetParent is not implemented in SSR');
};

export const __GetChildren: GetChildrenPAPI = (_element: HTMLElement) => {
  throw new Error('__GetChildren is not implemented in SSR');
};

export const __AddEvent: AddEventPAPI = () => {
  // Silent return for SSR compatibility
};

export const __GetEvent: GetEventPAPI = () => {
  throw new Error('__GetEvent is not implemented in SSR');
};

export const __GetEvents: GetEventsPAPI = () => {
  throw new Error('__GetEvents is not implemented in SSR');
};

export const __SetEvents: SetEventsPAPI = () => {
  throw new Error('__SetEvents is not implemented in SSR');
};

export const __UpdateListCallbacks: UpdateListCallbacksPAPI = () => {
  throw new Error('__UpdateListCallbacks is not implemented in SSR');
};

// __GetConfig uses GetElementConfigPAPI
export const __GetConfig: GetElementConfigPAPI = () => {
  throw new Error('__GetConfig is not implemented in SSR');
};

export const __SetConfig: SetConfigPAPI = () => {
  throw new Error('__SetConfig is not implemented in SSR');
};

export const __GetElementConfig: GetElementConfigPAPI = () => {
  throw new Error('__GetElementConfig is not implemented in SSR');
};

export const __GetComponentID: GetComponentIdPAPI = () => {
  throw new Error('__GetComponentID is not implemented in SSR');
};

export const __GetDataset: GetDatasetPAPI = (_element: HTMLElement) => {
  throw new Error('__GetDataset is not implemented in SSR');
};

export const __SetDataset: SetDatasetPAPI = (
  _element: HTMLElement,
  _dataset: Record<string, Cloneable>,
) => {
  throw new Error('__SetDataset is not implemented in SSR');
};

export const __AddDataset: AddDatasetPAPI = (
  _element: HTMLElement,
  _key: string,
  _value: Cloneable,
) => {
  throw new Error('__AddDataset is not implemented in SSR');
};

export const __GetDataByKey: GetDataByKeyPAPI = (
  _element: HTMLElement,
  _key: string,
) => {
  throw new Error('__GetDataByKey is not implemented in SSR');
};

export const __FirstElement: FirstElementPAPI = (_element: HTMLElement) => {
  throw new Error('__FirstElement is not implemented in SSR');
};

export const __LastElement: LastElementPAPI = (_element: HTMLElement) => {
  throw new Error('__LastElement is not implemented in SSR');
};

export const __NextElement: NextElementPAPI = (_element: HTMLElement) => {
  throw new Error('__NextElement is not implemented in SSR');
};

export const __RemoveElement: RemoveElementPAPI = (
  _parent: HTMLElement,
  _child: HTMLElement,
) => {
  throw new Error('__RemoveElement is not implemented in SSR');
};

export const __ReplaceElement: ReplaceElementPAPI = (
  _newEl: HTMLElement,
  _oldEl: HTMLElement,
) => {
  throw new Error('__ReplaceElement is not implemented in SSR');
};

export const __SwapElement: SwapElementPAPI = (
  _a: HTMLElement,
  _b: HTMLElement,
) => {
  throw new Error('__SwapElement is not implemented in SSR');
};

export const __AddConfig: AddConfigPAPI = () => {
  throw new Error('__AddConfig is not implemented in SSR');
};

export const __UpdateComponentInfo: UpdateComponentInfoPAPI = () => {
  throw new Error('__UpdateComponentInfo is not implemented in SSR');
};

export const __UpdateComponentID: UpdateComponentIDPAPI = () => {
  throw new Error('__UpdateComponentID is not implemented in SSR');
};

export const __MarkTemplateElement: MarkTemplateElementPAPI = () => {
  throw new Error('__MarkTemplateElement is not implemented in SSR');
};

export const __MarkPartElement: MarkPartElementPAPI = () => {
  throw new Error('__MarkPartElement is not implemented in SSR');
};

export const __GetTemplateParts: GetTemplatePartsPAPI = () => {
  throw new Error('__GetTemplateParts is not implemented in SSR');
};

export const __GetPageElement: GetPageElementPAPI = () => {
  throw new Error('__GetPageElement is not implemented in SSR');
};

export const __InsertElementBefore: InsertElementBeforePAPI = (
  _parent: HTMLElement,
  _child: HTMLElement,
  _ref: HTMLElement | null | undefined,
) => {
  throw new Error('__InsertElementBefore is not implemented in SSR');
};

export const __ReplaceElements: ReplaceElementsPAPI = (
  _parent: HTMLElement,
  _newChildren: HTMLElement[] | HTMLElement,
  _oldChildren: HTMLElement[] | HTMLElement | null | undefined,
) => {
  throw new Error('__ReplaceElements is not implemented in SSR');
};
