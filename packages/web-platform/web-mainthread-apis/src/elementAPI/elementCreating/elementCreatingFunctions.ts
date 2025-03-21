// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  type PageConfig,
  type ElementOperation,
  cssIdAttribute,
  type CssInJsInfo,
  parentComponentUniqueIdAttribute,
  lynxTagAttribute,
} from '@lynx-js/web-constants';
import { __UpdateComponentID } from '../attributeAndProperty/attributeAndPropertyFunctions.js';
import {
  type ComponentAtIndexCallback,
  type EnqueueComponentCallback,
  ListElement,
  ElementThreadElement,
} from '../ElementThreadElement.js';
import { __SetCSSId } from '../style/styleFunctions.js';
import { createOffscreenDocument } from '../createOffscreenDocument.js';

export interface initializeElementCreatingFunctionConfig {
  operationsRef: {
    operations: ElementOperation[];
  };
  pageConfig: PageConfig;
  styleInfo: CssInJsInfo;
  tagMap: Record<string, string>;
}

export function initializeElementCreatingFunction(
  config: initializeElementCreatingFunctionConfig,
) {
  const { operationsRef, pageConfig, styleInfo, tagMap } = config;
  const document = createOffscreenDocument({
    pageConfig,
    operationsRef,
    styleInfo,
  });
  function createLynxElement(
    tag: Exclude<string, 'list'>,
    parentComponentUniqueId: number,
    cssId?: number,
    componentId?: string,
    info?: Record<string, any> | null | undefined,
  ): ElementThreadElement;
  function createLynxElement(
    tag: 'list',
    parentComponentUniqueId: number,
    cssId?: number,
    componentId?: string,
    info?: Record<string, any> | null | undefined,
  ): ListElement;
  function createLynxElement(
    tag: string,
    parentComponentUniqueId: number,
    cssId?: number,
    componentId?: string,
    // @ts-expect-error
    info?: Record<string, any> | null | undefined,
  ) {
    const htmlTag = tagMap[tag] ?? tag;
    const element = document.createElement(htmlTag);
    element.setAttribute(lynxTagAttribute, tag);
    // element.parentComponentUniqueId = parentComponentUniqueId;
    element.setAttribute(
      parentComponentUniqueIdAttribute,
      parentComponentUniqueId.toString(),
    );
    if (cssId !== undefined) __SetCSSId([element], cssId);
    else if (parentComponentUniqueId >= 0) { // don't infer for uniqueid === -1
      const parentComponent = ElementThreadElement.getElementByUniqueId(
        parentComponentUniqueId,
      );
      const parentCssId = parentComponent?.getAttribute(cssIdAttribute);
      if (parentCssId && parentCssId !== '0') {
        __SetCSSId([element], parentCssId);
      }
    }
    if (componentId !== undefined) {
      __UpdateComponentID(element, componentId);
    }
    return element;
  }
  function __CreateComponent(
    componentParentUniqueID: number,
    componentID: string,
    cssID: number,
    // @ts-expect-error
    entryName: string,
    name: string,
    // @ts-expect-error
    path: string,
    config: Record<string, any> | null | undefined,
    // @ts-expect-error
    info: Record<string, any> | null | undefined,
  ) {
    const element = createLynxElement(
      'view',
      componentParentUniqueID,
      cssID,
      componentID,
      config,
    );
    element.setAttribute('name', name);
    return element;
  }

  function __CreateElement(
    tagName: string,
    parentComponentUniqueId: number,
    info?: object,
  ): ElementThreadElement {
    return createLynxElement(
      tagName,
      parentComponentUniqueId,
      undefined,
      undefined,
      info,
    );
  }

  function __CreatePage(
    componentID: string,
    cssID: number,
    info: Record<string, any> | null | undefined,
  ) {
    const page = createLynxElement('page', 0, cssID, componentID, info);
    page.setAttribute('part', 'page');
    page.setAttribute(
      parentComponentUniqueIdAttribute,
      page.uniqueId.toString(),
    );
    return page;
  }

  function __CreateView(parentComponentUniqueId: number) {
    const element = createLynxElement('view', parentComponentUniqueId);
    return element;
  }

  function __CreateText(parentComponentUniqueId: number) {
    const element = createLynxElement('text', parentComponentUniqueId);
    return element;
  }

  function __CreateRawText(text: string) {
    const element = createLynxElement('raw-text', -1);
    element.setAttribute('text', text);
    return element;
  }
  function __CreateImage(parentComponentUniqueId: number) {
    const element = createLynxElement('image', parentComponentUniqueId);
    return element;
  }

  function __CreateScrollView(parentComponentUniqueId: number) {
    const element = createLynxElement('scroll-view', parentComponentUniqueId);
    return element;
  }

  function __CreateWrapperElement(parentComponentUniqueId: number) {
    const element = createLynxElement('lynx-wrapper', parentComponentUniqueId);
    return element;
  }

  function __CreateList(
    parentComponentUniqueId: number,
    componentAtIndex: ComponentAtIndexCallback,
    enqueueComponent: EnqueueComponentCallback,
    info?: any,
  ): ListElement {
    const element = createLynxElement(
      'list',
      parentComponentUniqueId,
      undefined,
      undefined,
      info,
    ) as ListElement;
    element.componentAtIndex = componentAtIndex;
    element.enqueueComponent = enqueueComponent;
    return element;
  }

  return {
    __CreateView,
    __CreateText,
    __CreateComponent,
    __CreatePage,
    __CreateRawText,
    __CreateImage,
    __CreateScrollView,
    __CreateElement,
    __CreateWrapperElement,
    __CreateList,
  };
}
