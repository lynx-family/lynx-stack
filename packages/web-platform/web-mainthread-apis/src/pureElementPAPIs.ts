// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  componentIdAttribute,
  cssIdAttribute,
  lynxComponentConfigAttribute,
  lynxDatasetAttribute,
  lynxTagAttribute,
  lynxUniqueIdAttribute,
  type AddClassPAPI,
  type AddConfigPAPI,
  type AddDatasetPAPI,
  type AddInlineStylePAPI,
  type AppendElementPAPI,
  type ElementIsEqualPAPI,
  type FirstElementPAPI,
  type GetAttributesPAPI,
  type GetChildrenPAPI,
  type GetClassesPAPI,
  type GetComponentIdPAPI,
  type GetDataByKeyPAPI,
  type GetDatasetPAPI,
  type GetElementConfigPAPI,
  type GetElementUniqueIDPAPI,
  type GetIDPAPI,
  type GetParentPAPI,
  type GetTagPAPI,
  type InsertElementBeforePAPI,
  type LastElementPAPI,
  type NextElementPAPI,
  type RemoveElementPAPI,
  type ReplaceElementPAPI,
  type ReplaceElementsPAPI,
  type SetClassesPAPI,
  type SetConfigPAPI,
  type SetCSSIdPAPI,
  type SetDatasetPAPI,
  type SetIDPAPI,
  type SetInlineStylesPAPI,
  type UpdateComponentIDPAPI,
} from '@lynx-js/web-constants';
import { queryCSSProperty } from './style/cssPropertyMap.js';
import {
  transformInlineStyleString,
  transformParsedStyles,
} from './style/transformInlineStyle.js';
import hyphenateStyleName from 'hyphenate-style-name';

export const __AppendElement: AppendElementPAPI = /*#__PURE__*/ (
  parent,
  child,
) => parent.appendChild(child);

export const __ElementIsEqual: ElementIsEqualPAPI = /*#__PURE__*/ (
  left,
  right,
) => left === right;

export const __FirstElement: FirstElementPAPI = /*#__PURE__*/ (
  element,
) => element.firstElementChild;

export const __GetChildren: GetChildrenPAPI = /*#__PURE__*/ (
  element,
) => element.children;

export const __GetParent: GetParentPAPI = /*#__PURE__*/ (
  element,
) => element.parentElement;

export const __InsertElementBefore: InsertElementBeforePAPI = /*#__PURE__*/ (
  parent,
  child,
  ref,
) => parent.insertBefore(child, ref);

export const __LastElement: LastElementPAPI = /*#__PURE__*/ (
  element,
) => element.lastElementChild;

export const __NextElement: NextElementPAPI = /*#__PURE__*/ (
  element,
) => element.nextElementSibling;

export const __RemoveElement: RemoveElementPAPI = /*#__PURE__*/ (
  parent,
  child,
) => parent.removeChild(child);

export const __ReplaceElement: ReplaceElementPAPI = /*#__PURE__*/ (
  newElement,
  oldElement,
) => oldElement.replaceWith(newElement);

export const __ReplaceElements: ReplaceElementsPAPI = /*#__PURE__*/ (
  parent,
  newChildren,
  oldChildren,
) => {
  newChildren = Array.isArray(newChildren) ? newChildren : [newChildren];
  if (
    !oldChildren || (Array.isArray(oldChildren) && oldChildren?.length === 0)
  ) {
    parent.append(...newChildren);
  } else {
    oldChildren = Array.isArray(oldChildren) ? oldChildren : [oldChildren];
    for (let ii = 1; ii < oldChildren.length; ii++) {
      __RemoveElement(parent, oldChildren[ii]!);
    }
    const firstOldChildren = oldChildren[0]!;
    firstOldChildren.replaceWith(...newChildren);
  }
};
export const __AddConfig: AddConfigPAPI = /*#__PURE__*/ (
  element,
  type,
  value,
) => {
  const currentComponentConfigString = element.getAttribute(
    lynxComponentConfigAttribute,
  );
  let currentComponentConfig: Record<string, any> = currentComponentConfigString
    ? JSON.parse(decodeURIComponent(currentComponentConfigString))
    : {};
  currentComponentConfig[type] = value;
  element.setAttribute(
    lynxComponentConfigAttribute,
    encodeURIComponent(JSON.stringify(currentComponentConfig)),
  );
};

export const __AddDataset: AddDatasetPAPI = /*#__PURE__*/ (
  element,
  key,
  value,
) => {
  const currentDataset = __GetDataset(element);
  currentDataset[key] = value;
  element.setAttribute(
    lynxDatasetAttribute,
    encodeURIComponent(JSON.stringify(currentDataset)),
  );
  value
    ? element.setAttribute('data-' + key, value.toString())
    : element.removeAttribute('data-' + key);
};

export const __GetDataset: GetDatasetPAPI = /*#__PURE__*/ (
  element,
) => {
  const datasetString = element.getAttribute(lynxDatasetAttribute);
  const currentDataset: Record<string, any> = datasetString
    ? JSON.parse(decodeURIComponent(datasetString))
    : {};
  return currentDataset;
};

export const __GetDataByKey: GetDataByKeyPAPI = /*#__PURE__*/ (
  element,
  key,
) => {
  const dataset = __GetDataset(element);
  return dataset[key];
};

export const __GetAttributes: GetAttributesPAPI = /*#__PURE__*/ (
  element,
) => {
  return Object.fromEntries(
    element.getAttributeNames().map((
      attributeName,
    ) => [attributeName, element.getAttribute(attributeName)])
      .filter((
        [, value],
      ) => value) as [string, string][],
  );
};

export const __GetComponentID: GetComponentIdPAPI = /*#__PURE__*/ (element) =>
  element.getAttribute(componentIdAttribute);

export const __GetElementConfig: GetElementConfigPAPI = /*#__PURE__*/ (
  element,
) => {
  const currentComponentConfigString = element.getAttribute(
    lynxComponentConfigAttribute,
  );
  return currentComponentConfigString
    ? JSON.parse(decodeURIComponent(currentComponentConfigString))
    : {};
};

export const __GetElementUniqueID: GetElementUniqueIDPAPI = /*#__PURE__*/ (
  element,
) => (
  element && element.getAttribute
    ? Number(element.getAttribute(lynxUniqueIdAttribute))
    : -1
);

export const __GetID: GetIDPAPI = /*#__PURE__*/ (element) =>
  element.getAttribute('id');

export const __SetID: SetIDPAPI = /*#__PURE__*/ (element, id) =>
  id ? element.setAttribute('id', id) : element.removeAttribute('id');

export const __GetTag: GetTagPAPI = /*#__PURE__*/ (element) =>
  element.getAttribute(lynxTagAttribute)!;

export const __SetConfig: SetConfigPAPI = /*#__PURE__*/ (
  element,
  config,
) => {
  element.setAttribute(
    lynxComponentConfigAttribute,
    encodeURIComponent(JSON.stringify(config)),
  );
};

export const __SetDataset: SetDatasetPAPI = /*#__PURE__*/ (
  element,
  dataset,
) => {
  element.setAttribute(
    lynxDatasetAttribute,
    encodeURIComponent(JSON.stringify(dataset)),
  );
  for (const [key, value] of Object.entries(dataset)) {
    element.setAttribute('data-' + key, value!.toString());
  }
};

export const __UpdateComponentID: UpdateComponentIDPAPI = /*#__PURE__*/ (
  element,
  componentID,
) => element.setAttribute(componentIdAttribute, componentID);

export const __GetClasses: GetClassesPAPI = /*#__PURE__*/ (element) => (
  (element.getAttribute('class') ?? '').split(' ').filter(e => e)
);

export const __SetCSSId: SetCSSIdPAPI = /*#__PURE__*/ (
  elements,
  cssId,
) => {
  for (const element of elements) {
    element.setAttribute(cssIdAttribute, cssId + '');
  }
};

export const __SetClasses: SetClassesPAPI = /*#__PURE__*/ (
  element,
  classname,
) => {
  classname
    ? element.setAttribute('class', classname)
    : element.removeAttribute('class');
};

export const __AddInlineStyle: AddInlineStylePAPI = /*#__PURE__*/ (
  element,
  key: number | string,
  value: string | number | null | undefined,
) => {
  let dashName: string | undefined;
  if (typeof key === 'number') {
    const queryResult = queryCSSProperty(key);
    dashName = queryResult.dashName;
    if (queryResult.isX) {
      console.error(
        `[lynx-web] css property: ${dashName} is not supported.`,
      );
    }
  } else {
    dashName = key;
  }
  const valueStr = typeof value === 'number' ? value.toString() : value;
  if (!valueStr) { // null or undefined
    element.style.removeProperty(dashName);
  } else {
    const { transformedStyle } = transformParsedStyles([[
      dashName,
      valueStr,
    ]]);
    for (const [property, value] of transformedStyle) {
      element.style.setProperty(property, value);
    }
  }
};

export const __AddClass: AddClassPAPI = /*#__PURE__*/ (
  element,
  className,
) => {
  const newClassName = ((element.getAttribute('class') ?? '') + ' ' + className)
    .trim();
  element.setAttribute('class', newClassName);
};

export const __SetInlineStyles: SetInlineStylesPAPI = /*#__PURE__*/ (
  element,
  value,
) => {
  if (!value) return;
  if (typeof value === 'string') {
    element.setAttribute('style', transformInlineStyleString(value));
  } else {
    const { transformedStyle } = transformParsedStyles(
      Object.entries(value).map(([k, value]) => [
        hyphenateStyleName(k),
        value,
      ]),
    );
    const transformedStyleStr = transformedStyle.map((
      [property, value],
    ) => `${property}:${value};`).join('');
    element.setAttribute('style', transformedStyleStr);
  }
};
