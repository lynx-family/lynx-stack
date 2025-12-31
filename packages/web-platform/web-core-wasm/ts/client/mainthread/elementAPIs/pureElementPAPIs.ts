// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  HTML_TAG_TO_LYNX_TAG_MAP,
  lynxElementTemplateMarkerAttribute,
  lynxPartIdAttribute,
  uniqueIdSymbol,
} from '../../../constants.js';

import type {
  AddClassPAPI,
  AppendElementPAPI,
  DecoratedHTMLElement,
  ElementIsEqualPAPI,
  FirstElementPAPI,
  GetAttributeByNamePAPI,
  GetAttributesPAPI,
  GetChildrenPAPI,
  GetClassesPAPI,
  GetElementUniqueIDPAPI,
  GetIDPAPI,
  GetParentPAPI,
  GetTagPAPI,
  GetTemplatePartsPAPI,
  InsertElementBeforePAPI,
  LastElementPAPI,
  MarkPartElementPAPI,
  MarkTemplateElementPAPI,
  NextElementPAPI,
  RemoveElementPAPI,
  ReplaceElementPAPI,
  ReplaceElementsPAPI,
  SetClassesPAPI,
  SetIDPAPI,
  SwapElementPAPI,
  UpdateListCallbacksPAPI,
} from '../../../types/index.js';

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
) => element.firstElementChild as HTMLElement | null;

export const __GetChildren: GetChildrenPAPI = /*#__PURE__*/ (
  element,
  // @ts-expect-error
) => element.children ? [...element.children] : null;

export const __GetParent: GetParentPAPI = /*#__PURE__*/ (
  element,
) => element.parentElement;

export const __InsertElementBefore: InsertElementBeforePAPI = /*#__PURE__*/ (
  parent,
  child,
  ref,
) => parent.insertBefore(child, ref as Node | null);

export const __LastElement: LastElementPAPI = /*#__PURE__*/ (
  element,
) => element.lastElementChild as HTMLElement | null;

export const __NextElement: NextElementPAPI = /*#__PURE__*/ (
  element,
) => element.nextElementSibling as HTMLElement | null;

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

export const __GetAttributeByName: GetAttributeByNamePAPI = /*#__PURE__*/ (
  element,
  name,
) => element.getAttribute(name);

export const __GetID: GetIDPAPI = /*#__PURE__*/ (element) =>
  element.getAttribute('id');

export const __SetID: SetIDPAPI = /*#__PURE__*/ (element, id) =>
  id ? element.setAttribute('id', id) : element.removeAttribute('id');

export const __GetTag: GetTagPAPI = /*#__PURE__*/ (element) => {
  const tagName = element.tagName.toLowerCase();
  return HTML_TAG_TO_LYNX_TAG_MAP[tagName] ?? tagName;
};

export const __GetClasses: GetClassesPAPI = /*#__PURE__*/ (
  element,
) => [...(element.classList as any as string[])];

export const __SwapElement: SwapElementPAPI = /*#__PURE__*/ (
  childA,
  childB,
) => {
  const temp = document.createElement('div');
  childA.replaceWith(temp);
  childB.replaceWith(childA);
  temp.replaceWith(childB);
};

export const __SetClasses: SetClassesPAPI = /*#__PURE__*/ (
  element,
  classname,
) => {
  classname
    ? element.setAttribute('class', classname)
    : element.removeAttribute('class');
};

export const __AddClass: AddClassPAPI = /*#__PURE__*/ (
  element,
  className,
) => {
  element.classList.add(className);
};

export const __GetTemplateParts: GetTemplatePartsPAPI = (
  templateElement,
) => {
  const isTemplate =
    templateElement.getAttribute(lynxElementTemplateMarkerAttribute)
      !== null;
  if (!isTemplate) {
    return {};
  }
  const templateUniqueId = __GetElementUniqueID(templateElement);
  const parts: Record<string, HTMLElement> = {};
  const partElements = templateElement.querySelectorAll!(
    `[${lynxPartIdAttribute}]:not([${lynxElementTemplateMarkerAttribute}="${templateUniqueId}"] [${lynxElementTemplateMarkerAttribute}] [${lynxPartIdAttribute}])`,
  ) as unknown as HTMLElement[];
  for (const partElement of partElements) {
    const partId = partElement.getAttribute(lynxPartIdAttribute);
    if (partId) {
      parts[partId] = partElement as HTMLElement;
    }
  }
  return parts;
};

export const __MarkTemplateElement: MarkTemplateElementPAPI = (
  element,
) => {
  const templateUniqueId = __GetElementUniqueID(element);
  element.setAttribute(
    lynxElementTemplateMarkerAttribute,
    templateUniqueId.toString(),
  );
};

export const __MarkPartElement: MarkPartElementPAPI = (
  element,
  partId,
) => {
  element.setAttribute(lynxPartIdAttribute, partId);
};

export const __GetElementUniqueID: GetElementUniqueIDPAPI = /*#__PURE__*/ (
  element,
) => (element && (element as DecoratedHTMLElement)[uniqueIdSymbol]) ?? -1;

export const __UpdateListCallbacks: UpdateListCallbacksPAPI = /*#__PURE__*/ (
  element,
  componentAtIndex,
  enqueueComponent,
) => {
  const decoratedElement = element as DecoratedHTMLElement;
  decoratedElement.componentAtIndex = componentAtIndex;
  decoratedElement.enqueueComponent = enqueueComponent;
};
