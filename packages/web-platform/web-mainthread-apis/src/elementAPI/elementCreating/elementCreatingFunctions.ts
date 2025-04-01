// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  cssIdAttribute,
  lynxUniqueIdAttribute,
  lynxTagAttribute,
  lynxDefaultDisplayLinearAttribute,
} from '@lynx-js/web-constants';
import {
  type ComponentAtIndexCallback,
  type EnqueueComponentCallback,
  type LynxRuntimeInfo,
} from '../ElementThreadElement.js';
import {
  elementToRuntimeInfoMap,
  getElementByUniqueId,
  lynxUniqueIdToElement,
  type MainThreadRuntime,
} from '../../MainThreadRuntime.js';
import type { createStyleFunctions } from '../style/styleFunctions.js';

export function initializeElementCreatingFunction(
  runtime: MainThreadRuntime,
) {
  let uniqueIdInc = 1;
  function createLynxElement(
    tag: string,
    parentComponentUniqueId: number,
    cssId?: number,
    componentId?: string,
    // @ts-expect-error
    info?: Record<string, any> | null | undefined,
  ) {
    // @ts-expect-error
    const __SetCSSId = runtime.__SetCSSId as ReturnType<
      typeof createStyleFunctions
    >['__SetCSSId'];
    const htmlTag = runtime.config.tagMap[tag] ?? tag;
    const element = runtime.config.docu.createElement(
      htmlTag,
    ) as HTMLElement;
    element.setAttribute(lynxTagAttribute, tag);
    const uniqueId = uniqueIdInc++;
    const runtimeInfo: LynxRuntimeInfo = {
      uniqueId,
      componentConfig: {},
      lynxDataset: {},
      eventHandlerMap: {},
      parentComponentUniqueId,
    };
    runtime[elementToRuntimeInfoMap].set(element, runtimeInfo);
    runtime[lynxUniqueIdToElement][uniqueId] = new WeakRef(element);
    element.setAttribute(lynxUniqueIdAttribute, uniqueId.toString());
    if (cssId !== undefined) __SetCSSId([element], cssId);
    else if (parentComponentUniqueId >= 0) { // don't infer for uniqueid === -1
      const parentComponent = runtime[getElementByUniqueId](
        parentComponentUniqueId,
      );
      const parentCssId = parentComponent?.getAttribute(cssIdAttribute);
      if (parentCssId && parentCssId !== '0') {
        __SetCSSId([element], parentCssId);
      }
    }
    if (componentId !== undefined) {
      // @ts-expect-error
      runtime.__UpdateComponentID(element, componentId);
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
  ): HTMLElement {
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
    const runtimeInfo = runtime[elementToRuntimeInfoMap].get(page)!;
    runtimeInfo.parentComponentUniqueId = runtimeInfo.uniqueId;
    if (runtime.config.pageConfig.defaultDisplayLinear === false) {
      page.setAttribute(lynxDefaultDisplayLinearAttribute, 'false');
    }
    if (runtime.config.pageConfig.defaultOverflowVisible === true) {
      page.setAttribute('lynx-default-overflow-visible', 'true');
    }
    runtime._page = page;
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
  ): HTMLElement {
    const element = createLynxElement(
      'list',
      parentComponentUniqueId,
      undefined,
      undefined,
      info,
    ) as HTMLElement;
    const runtimeInfo = runtime[elementToRuntimeInfoMap].get(element)!;
    runtimeInfo.componentAtIndex = componentAtIndex;
    runtimeInfo.enqueueComponent = enqueueComponent;
    return element;
  }
  function __SwapElement(
    childA: HTMLElement,
    childB: HTMLElement,
  ): void {
    const temp = runtime.config.docu.createElement('div');
    childA.replaceWith(temp);
    childB.replaceWith(childA);
    temp.replaceWith(childB);
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
    __SwapElement,
  };
}
