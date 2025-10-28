// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  type LynxTemplate,
  type PageConfig,
  type FlushElementTreeOptions,
  type Cloneable,
  type BrowserConfig,
  lynxUniqueIdAttribute,
  type publishEventEndpoint,
  type publicComponentEventEndpoint,
  type reportErrorEndpoint,
  type RpcCallType,
  type LynxContextEventTarget,
  systemInfo,
  type AddEventPAPI,
  type GetEventsPAPI,
  type GetEventPAPI,
  type MainThreadGlobalThis,
  type SetEventsPAPI,
  type CreateElementPAPI,
  parentComponentUniqueIdAttribute,
  componentIdAttribute,
  LynxEventNameToW3cByTagName,
  LynxEventNameToW3cCommon,
  type LynxEventType,
  lynxTagAttribute,
  type MainThreadScriptEvent,
  W3cEventNameToLynx,
  type WebFiberElementImpl,
  type LynxRuntimeInfo,
  type CreateViewPAPI,
  type CreateTextPAPI,
  type CreateImagePAPI,
  type CreateScrollViewPAPI,
  type CreateWrapperElementPAPI,
  type CreatePagePAPI,
  cssIdAttribute,
  lynxDefaultDisplayLinearAttribute,
  type CreateRawTextPAPI,
  type CreateListPAPI,
  type CreateComponentPAPI,
  type SetAttributePAPI,
  type UpdateListInfoAttributeValue,
  __lynx_timing_flag,
  type UpdateListCallbacksPAPI,
  type SwapElementPAPI,
  type SetCSSIdPAPI,
  type AddClassPAPI,
  type SetClassesPAPI,
  type GetPageElementPAPI,
  type MinimalRawEventObject,
  type I18nResourceTranslationOptions,
  lynxDisposedAttribute,
  type SSRHydrateInfo,
  type SSRDehydrateHooks,
  type ElementTemplateData,
  type ElementFromBinaryPAPI,
  type JSRealm,
  type QueryComponentPAPI,
  lynxEntryNameAttribute,
} from '@lynx-js/web-constants';
import { createMainThreadLynx } from './createMainThreadLynx.js';
import {
  __AddClass,
  __AddConfig,
  __AddDataset,
  __AddInlineStyle,
  __AppendElement,
  __ElementIsEqual,
  __FirstElement,
  __GetAttributes,
  __GetChildren,
  __GetClasses,
  __GetComponentID,
  __GetDataByKey,
  __GetDataset,
  __GetElementConfig,
  __GetElementUniqueID,
  __GetID,
  __GetParent,
  __GetTag,
  __GetTemplateParts,
  __InsertElementBefore,
  __LastElement,
  __MarkPartElement,
  __MarkTemplateElement,
  __NextElement,
  __RemoveElement,
  __ReplaceElement,
  __ReplaceElements,
  __SetClasses,
  __SetConfig,
  __SetCSSId,
  __SetDataset,
  __SetID,
  __SetInlineStyles,
  __UpdateComponentID,
  __UpdateComponentInfo,
  __GetAttributeByName,
} from './pureElementPAPIs.js';
import { createCrossThreadEvent } from './utils/createCrossThreadEvent.js';

const exposureRelatedAttributes = new Set<string>([
  'exposure-id',
  'exposure-area',
  'exposure-screen-margin-top',
  'exposure-screen-margin-right',
  'exposure-screen-margin-bottom',
  'exposure-screen-margin-left',
  'exposure-ui-margin-top',
  'exposure-ui-margin-right',
  'exposure-ui-margin-bottom',
  'exposure-ui-margin-left',
]);

export interface MainThreadRuntimeCallbacks {
  mainChunkReady: () => void;
  flushElementTree: (
    options: FlushElementTreeOptions,
    timingFlags: string[],
    exposureChangedElements: WebFiberElementImpl[],
  ) => void;
  _ReportError: RpcCallType<typeof reportErrorEndpoint>;
  __OnLifecycleEvent: (lifeCycleEvent: Cloneable) => void;
  markTiming: (pipelineId: string, timingKey: string) => void;
  publishEvent: RpcCallType<typeof publishEventEndpoint>;
  publicComponentEvent: RpcCallType<typeof publicComponentEventEndpoint>;
  _I18nResourceTranslation: (
    options: I18nResourceTranslationOptions,
  ) => unknown | undefined;
  updateCssOGStyle: (
    uniqueId: number,
    newClassName: string,
    cssID: string | null,
    entryName: string | null,
  ) => void;
  __QueryComponent: QueryComponentPAPI;
}

export interface MainThreadRuntimeConfig {
  pageConfig: PageConfig;
  globalProps: unknown;
  callbacks: MainThreadRuntimeCallbacks;
  lynxTemplate: LynxTemplate;
  browserConfig: BrowserConfig;
  tagMap: Record<string, string>;
  rootDom:
    & Pick<Element, 'append' | 'addEventListener'>
    & Partial<Pick<ShadowRoot, 'querySelectorAll' | 'cloneNode'>>;
  jsContext: LynxContextEventTarget;
  ssrHydrateInfo?: SSRHydrateInfo;
  ssrHooks?: SSRDehydrateHooks;
  mtsRealm: JSRealm;
  document: Document;
}

export function createMainThreadGlobalThis(
  config: MainThreadRuntimeConfig,
): MainThreadGlobalThis {
  let timingFlags: string[] = [];
  const {
    callbacks,
    tagMap,
    pageConfig,
    lynxTemplate,
    rootDom,
    globalProps,
    ssrHydrateInfo,
    ssrHooks,
    mtsRealm,
    document,
  } = config;
  const { elementTemplate, lepusCode } = lynxTemplate;
  const lynxUniqueIdToElement: WeakRef<WebFiberElementImpl>[] =
    ssrHydrateInfo?.lynxUniqueIdToElement ?? [];
  const elementToRuntimeInfoMap: WeakMap<WebFiberElementImpl, LynxRuntimeInfo> =
    new WeakMap();

  let pageElement: WebFiberElementImpl | undefined = lynxUniqueIdToElement[1]
    ?.deref();
  let uniqueIdInc = lynxUniqueIdToElement.length || 1;
  const exposureChangedElements = new Set<WebFiberElementImpl>();

  const commonHandler = (event: Event) => {
    if (!event.currentTarget) {
      return;
    }
    const currentTarget = event.currentTarget as HTMLElement;
    const isCapture = event.eventPhase === Event.CAPTURING_PHASE;
    const lynxEventName = W3cEventNameToLynx[event.type] ?? event.type;
    const runtimeInfo = elementToRuntimeInfoMap.get(
      currentTarget as any as WebFiberElementImpl,
    );
    if (runtimeInfo) {
      const hname = isCapture
        ? runtimeInfo.eventHandlerMap[lynxEventName]?.capture
          ?.handler
        : runtimeInfo.eventHandlerMap[lynxEventName]?.bind
          ?.handler;
      const crossThreadEvent = createCrossThreadEvent(
        event as MinimalRawEventObject,
        lynxEventName,
      );
      if (typeof hname === 'string') {
        const parentComponentUniqueId = Number(
          currentTarget.getAttribute(parentComponentUniqueIdAttribute)!,
        );
        const parentComponent = lynxUniqueIdToElement[parentComponentUniqueId]!
          .deref()!;
        const componentId =
          parentComponent?.getAttribute(lynxTagAttribute) !== 'page'
            ? parentComponent?.getAttribute(componentIdAttribute) ?? undefined
            : undefined;
        if (componentId) {
          callbacks.publicComponentEvent(
            componentId,
            hname,
            crossThreadEvent,
          );
        } else {
          callbacks.publishEvent(
            hname,
            crossThreadEvent,
          );
        }
        return true;
      } else if (hname) {
        (crossThreadEvent as MainThreadScriptEvent).target.elementRefptr =
          event.target;
        if (crossThreadEvent.currentTarget) {
          (crossThreadEvent as MainThreadScriptEvent).currentTarget!
            .elementRefptr = event.currentTarget;
        }
        (mtsRealm.globalWindow as typeof globalThis & MainThreadGlobalThis)
          .runWorklet?.(hname.value, [crossThreadEvent]);
      }
    }
    return false;
  };
  const commonCatchHandler = (event: Event) => {
    const handlerTriggered = commonHandler(event);
    if (handlerTriggered) event.stopPropagation();
  };
  const __AddEvent: AddEventPAPI = (
    element,
    eventType,
    eventName,
    newEventHandler,
  ) => {
    eventName = eventName.toLowerCase();
    const isCatch = eventType === 'catchEvent' || eventType === 'capture-catch';
    const isCapture = eventType.startsWith('capture');
    const runtimeInfo = elementToRuntimeInfoMap.get(element) ?? {
      eventHandlerMap: {},
      componentAtIndex: undefined,
      enqueueComponent: undefined,
    };
    const currentHandler = isCapture
      ? runtimeInfo.eventHandlerMap[eventName]?.capture
      : runtimeInfo.eventHandlerMap[eventName]?.bind;
    const currentRegisteredHandler = isCatch
      ? commonCatchHandler
      : commonHandler;
    if (currentHandler) {
      if (!newEventHandler) {
        /**
         * remove handler
         */
        element.removeEventListener(eventName, currentRegisteredHandler, {
          capture: isCapture,
        });
        // remove the exposure id if the exposure-id is a placeholder value
        const isExposure = eventName === 'uiappear'
          || eventName === 'uidisappear';
        if (isExposure && element.getAttribute('exposure-id') === '-1') {
          mtsGlobalThis.__SetAttribute(element, 'exposure-id', null);
        }
      }
    } else {
      /**
       * append new handler
       */
      if (newEventHandler) {
        const htmlEventName =
          LynxEventNameToW3cByTagName[element.tagName]?.[eventName]
            ?? LynxEventNameToW3cCommon[eventName] ?? eventName;
        element.addEventListener(htmlEventName, currentRegisteredHandler, {
          capture: isCapture,
        });
        // add exposure id if no exposure-id is set
        const isExposure = eventName === 'uiappear'
          || eventName === 'uidisappear';
        if (isExposure && element.getAttribute('exposure-id') === null) {
          mtsGlobalThis.__SetAttribute(element, 'exposure-id', '-1');
        }
      }
    }
    if (newEventHandler) {
      const info = {
        type: eventType,
        handler: newEventHandler,
      };
      if (!runtimeInfo.eventHandlerMap[eventName]) {
        runtimeInfo.eventHandlerMap[eventName] = {
          capture: undefined,
          bind: undefined,
        };
      }
      if (isCapture) {
        runtimeInfo.eventHandlerMap[eventName]!.capture = info;
      } else {
        runtimeInfo.eventHandlerMap[eventName]!.bind = info;
      }
    }
    elementToRuntimeInfoMap.set(element, runtimeInfo);
  };

  const __GetEvent: GetEventPAPI = (
    element,
    eventName,
    eventType,
  ) => {
    const runtimeInfo = elementToRuntimeInfoMap.get(element);
    if (runtimeInfo) {
      eventName = eventName.toLowerCase();
      const isCapture = eventType.startsWith('capture');
      const handler = isCapture
        ? runtimeInfo.eventHandlerMap[eventName]?.capture
        : runtimeInfo.eventHandlerMap[eventName]?.bind;
      return handler?.handler;
    } else {
      return undefined;
    }
  };

  const __GetEvents: GetEventsPAPI = (element) => {
    const eventHandlerMap =
      elementToRuntimeInfoMap.get(element)?.eventHandlerMap ?? {};
    const eventInfos: {
      type: LynxEventType;
      name: string;
      function: string | { type: 'worklet'; value: unknown } | undefined;
    }[] = [];
    for (const [lynxEventName, info] of Object.entries(eventHandlerMap)) {
      for (const atomInfo of [info.bind, info.capture]) {
        if (atomInfo) {
          const { type, handler } = atomInfo;
          if (handler) {
            eventInfos.push({
              type: type as LynxEventType,
              name: lynxEventName,
              function: handler,
            });
          }
        }
      }
    }
    return eventInfos;
  };

  const __SetEvents: SetEventsPAPI = (
    element,
    listeners,
  ) => {
    for (
      const { type: eventType, name: lynxEventName, function: eventHandler }
        of listeners
    ) {
      __AddEvent(element, eventType, lynxEventName, eventHandler);
    }
  };

  const __CreateElement: CreateElementPAPI = (
    tag,
    parentComponentUniqueId,
  ) => {
    const uniqueId = uniqueIdInc++;
    const htmlTag = tagMap[tag] ?? tag;
    const element = document.createElement(
      htmlTag,
    ) as unknown as WebFiberElementImpl;
    lynxUniqueIdToElement[uniqueId] = new WeakRef(element);
    const parentComponentCssID = lynxUniqueIdToElement[parentComponentUniqueId]
      ?.deref()?.getAttribute(cssIdAttribute);
    parentComponentCssID && parentComponentCssID !== '0'
      && element.setAttribute(cssIdAttribute, parentComponentCssID);
    element.setAttribute(lynxTagAttribute, tag);
    element.setAttribute(lynxUniqueIdAttribute, uniqueId + '');
    element.setAttribute(
      parentComponentUniqueIdAttribute,
      parentComponentUniqueId + '',
    );
    return element;
  };

  const __CreateView: CreateViewPAPI = (
    parentComponentUniqueId: number,
  ) => __CreateElement('view', parentComponentUniqueId);

  const __CreateText: CreateTextPAPI = (
    parentComponentUniqueId: number,
  ) => __CreateElement('text', parentComponentUniqueId);

  const __CreateRawText: CreateRawTextPAPI = (
    text: string,
  ) => {
    const element = __CreateElement('raw-text', -1);
    element.setAttribute('text', text);
    return element;
  };

  const __CreateImage: CreateImagePAPI = (
    parentComponentUniqueId: number,
  ) => __CreateElement('image', parentComponentUniqueId);

  const __CreateScrollView: CreateScrollViewPAPI = (
    parentComponentUniqueId: number,
  ) => __CreateElement('scroll-view', parentComponentUniqueId);

  const __CreateWrapperElement: CreateWrapperElementPAPI = (
    parentComponentUniqueId: number,
  ) => __CreateElement('lynx-wrapper', parentComponentUniqueId);

  const __CreatePage: CreatePagePAPI = (
    componentID,
    cssID,
  ) => {
    const page = __CreateElement('page', 0);
    page.setAttribute('part', 'page');
    page.setAttribute(cssIdAttribute, cssID + '');
    page.setAttribute(parentComponentUniqueIdAttribute, '0');
    page.setAttribute(componentIdAttribute, componentID);
    __MarkTemplateElement(page);
    if (pageConfig.defaultDisplayLinear === false) {
      page.setAttribute(lynxDefaultDisplayLinearAttribute, 'false');
    }
    if (pageConfig.defaultOverflowVisible === true) {
      page.setAttribute('lynx-default-overflow-visible', 'true');
    }
    pageElement = page;
    return page;
  };

  const __CreateList: CreateListPAPI = (
    parentComponentUniqueId,
    componentAtIndex,
    enqueueComponent,
  ) => {
    const list = __CreateElement('list', parentComponentUniqueId);
    const runtimeInfo: LynxRuntimeInfo = {
      eventHandlerMap: {},
      componentAtIndex: componentAtIndex,
      enqueueComponent: enqueueComponent,
    };
    elementToRuntimeInfoMap.set(list, runtimeInfo);
    return list;
  };

  const __CreateComponent: CreateComponentPAPI = (
    componentParentUniqueID,
    componentID,
    cssID,
    _,
    name,
  ) => {
    const component = __CreateElement('view', componentParentUniqueID);
    component.setAttribute(cssIdAttribute, cssID + '');
    component.setAttribute(componentIdAttribute, componentID);
    component.setAttribute('name', name);
    return component;
  };

  const __SetAttribute: SetAttributePAPI = (
    element,
    key,
    value,
  ) => {
    const tag = element.getAttribute(lynxTagAttribute)!;
    if (tag === 'list' && key === 'update-list-info') {
      const listInfo = value as UpdateListInfoAttributeValue;
      const { insertAction, removeAction } = listInfo;
      queueMicrotask(() => {
        const runtimeInfo = elementToRuntimeInfoMap.get(element);
        if (runtimeInfo) {
          const componentAtIndex = runtimeInfo.componentAtIndex;
          const enqueueComponent = runtimeInfo.enqueueComponent;
          const uniqueId = __GetElementUniqueID(element);
          for (const action of insertAction) {
            componentAtIndex?.(
              element,
              uniqueId,
              action.position,
              0,
              false,
            );
          }
          for (const action of removeAction) {
            enqueueComponent?.(element, uniqueId, action.position);
          }
        }
      });
    } else {
      value == null
        ? element.removeAttribute(key)
        : element.setAttribute(key, value + '');
      if (key === __lynx_timing_flag && value) {
        timingFlags.push(value as string);
      }
      if (exposureRelatedAttributes.has(key)) {
        // if the attribute is related to exposure, we need to mark the element as changed
        exposureChangedElements.add(element);
      }
    }
  };

  const __UpdateListCallbacks: UpdateListCallbacksPAPI = (
    element,
    componentAtIndex,
    enqueueComponent,
  ) => {
    const runtimeInfo = elementToRuntimeInfoMap.get(element) ?? {
      eventHandlerMap: {},
      componentAtIndex: componentAtIndex,
      enqueueComponent: enqueueComponent,
      uniqueId: __GetElementUniqueID(element),
    };
    runtimeInfo.componentAtIndex = componentAtIndex;
    runtimeInfo.enqueueComponent = enqueueComponent;
    elementToRuntimeInfoMap.set(element, runtimeInfo);
  };
  const __SwapElement: SwapElementPAPI = (
    childA,
    childB,
  ) => {
    const temp = document.createElement('div');
    // @ts-expect-error fixme
    childA.replaceWith(temp);
    childB.replaceWith(childA);
    // @ts-expect-error fixme
    temp.replaceWith(childB);
  };

  const __SetCSSIdForCSSOG: SetCSSIdPAPI = (
    elements,
    cssId,
    entryName,
  ) => {
    for (const element of elements) {
      element.setAttribute(cssIdAttribute, cssId + '');
      entryName && element.setAttribute(lynxEntryNameAttribute, entryName);
      const cls = element.getAttribute('class');
      cls && __SetClassesForCSSOG(element, cls);
    }
  };

  const __AddClassForCSSOG: AddClassPAPI = (
    element,
    className,
  ) => {
    const newClassName =
      ((element.getAttribute('class') ?? '') + ' ' + className)
        .trim();
    element.setAttribute('class', newClassName);
    const cssId = element.getAttribute(cssIdAttribute);
    const uniqueId = Number(element.getAttribute(lynxUniqueIdAttribute));
    const entryName = element.getAttribute(lynxEntryNameAttribute);
    callbacks.updateCssOGStyle(
      uniqueId,
      newClassName,
      cssId,
      entryName,
    );
  };

  const __SetClassesForCSSOG: SetClassesPAPI = (
    element,
    classNames,
  ) => {
    __SetClasses(element, classNames);
    const cssId = element.getAttribute(cssIdAttribute);
    const uniqueId = Number(element.getAttribute(lynxUniqueIdAttribute));
    const entryName = element.getAttribute(lynxEntryNameAttribute);
    callbacks.updateCssOGStyle(
      uniqueId,
      classNames ?? '',
      cssId,
      entryName,
    );
  };

  const __LoadLepusChunk: (path: string) => boolean = (path) => {
    try {
      path = lepusCode?.[path] ?? path;
      mtsRealm.loadScriptSync(path);
      return true;
    } catch (e) {
      console.error(`failed to load lepus chunk ${path}`, e);
      return false;
    }
  };

  const __FlushElementTree: (
    _subTree: unknown,
    options: FlushElementTreeOptions,
  ) => void = (
    _subTree,
    options,
  ) => {
    const timingFlagsCopied = timingFlags;
    timingFlags = [];
    if (
      pageElement && !pageElement.parentNode
      && pageElement.getAttribute(lynxDisposedAttribute) !== ''
    ) {
      // @ts-expect-error
      rootDom.append(pageElement);
    }
    const exposureChangedElementsArray = Array.from(exposureChangedElements);
    exposureChangedElements.clear();
    callbacks.flushElementTree(
      options,
      timingFlagsCopied,
      exposureChangedElementsArray,
    );
  };

  const __GetPageElement: GetPageElementPAPI = () => {
    return pageElement;
  };

  const templateIdToTemplate: Record<string, HTMLTemplateElement> = {};

  const createElementForElementTemplateData = (
    data: ElementTemplateData,
    parentComponentUniId: number,
  ): WebFiberElementImpl => {
    const element = __CreateElement(data.type, parentComponentUniId);
    __SetID(element, data.id);
    data.class && __SetClasses(element, data.class.join(' '));
    for (const [key, value] of Object.entries(data.attributes || {})) {
      __SetAttribute(element, key, value);
    }
    for (const [key, value] of Object.entries(data.builtinAttributes || {})) {
      if (key === 'dirtyID' && value === data.id) {
        __MarkPartElement(element, value);
      }
      __SetAttribute(element, key, value);
    }
    for (const childData of data.children || []) {
      __AppendElement(
        element,
        createElementForElementTemplateData(childData, parentComponentUniId),
      );
    }
    data.dataset !== undefined && __SetDataset(element, data.dataset);
    return element;
  };

  const applyEventsForElementTemplate: (
    data: ElementTemplateData,
    element: WebFiberElementImpl,
  ) => void = (data, element) => {
    const uniqueId = uniqueIdInc++;
    element.setAttribute(lynxUniqueIdAttribute, uniqueId + '');
    for (const event of data.events || []) {
      const { type, name, value } = event;
      __AddEvent(element, type, name, value);
    }
    for (let ii = 0; ii < (data.children || []).length; ii++) {
      const childData = (data.children || [])[ii];
      const childElement = element.children[ii] as WebFiberElementImpl;
      if (childData && childElement) {
        applyEventsForElementTemplate(childData, childElement);
      }
    }
  };

  const __ElementFromBinary: ElementFromBinaryPAPI = (
    templateId,
    parentComponentUniId,
  ) => {
    const elementTemplateData = elementTemplate[templateId];
    if (elementTemplateData) {
      let clonedElements: WebFiberElementImpl[];
      if (templateIdToTemplate[templateId]) {
        clonedElements = Array.from(
          (templateIdToTemplate[templateId].content.cloneNode(
            true,
          ) as DocumentFragment).children,
        ) as unknown as WebFiberElementImpl[];
      } else {
        clonedElements = elementTemplateData.map(data =>
          createElementForElementTemplateData(data, parentComponentUniId)
        );
        if (rootDom.cloneNode) {
          const template = document.createElement(
            'template',
          ) as unknown as HTMLTemplateElement;
          template.content.append(...clonedElements as unknown as Node[]);
          templateIdToTemplate[templateId] = template;
          rootDom.append(template);
          return __ElementFromBinary(templateId, parentComponentUniId);
        }
      }
      for (let ii = 0; ii < clonedElements.length; ii++) {
        const data = elementTemplateData[ii];
        const element = clonedElements[ii];
        if (data && element) {
          applyEventsForElementTemplate(data, element);
        }
      }
      clonedElements.forEach(__MarkTemplateElement);
      return clonedElements;
    }
    return [];
  };

  let release = '';
  const isCSSOG = !pageConfig.enableCSSSelector;
  const SystemInfo = {
    ...systemInfo,
    ...config.browserConfig,
  };
  const mtsGlobalThis: MainThreadGlobalThis = {
    __ElementFromBinary,
    __GetTemplateParts: rootDom.querySelectorAll
      ? __GetTemplateParts
      : undefined,
    __MarkTemplateElement,
    __MarkPartElement,
    __AddEvent: ssrHooks?.__AddEvent ?? __AddEvent,
    __GetEvent,
    __GetEvents,
    __SetEvents,
    __AppendElement,
    __ElementIsEqual,
    __FirstElement,
    __GetChildren,
    __GetParent,
    __InsertElementBefore,
    __LastElement,
    __NextElement,
    __RemoveElement,
    __ReplaceElement,
    __ReplaceElements,
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
    __UpdateComponentInfo,
    __CreateElement,
    __CreateView,
    __CreateText,
    __CreateComponent,
    __CreatePage,
    __CreateRawText,
    __CreateImage,
    __CreateScrollView,
    __CreateWrapperElement,
    __CreateList,
    __SetAttribute,
    __SwapElement,
    __UpdateListCallbacks,
    __GetConfig: __GetElementConfig,
    __GetAttributeByName,
    __GetClasses,
    __AddClass: isCSSOG ? __AddClassForCSSOG : __AddClass,
    __SetClasses: isCSSOG ? __SetClassesForCSSOG : __SetClasses,
    __AddInlineStyle,
    __SetCSSId: isCSSOG ? __SetCSSIdForCSSOG : __SetCSSId,
    __SetInlineStyles,
    __LoadLepusChunk,
    __GetPageElement,
    __globalProps: globalProps,
    __QueryComponent: callbacks.__QueryComponent,
    SystemInfo,
    lynx: createMainThreadLynx(config, SystemInfo),
    _ReportError: (err, _) => callbacks._ReportError(err, _, release),
    _SetSourceMapRelease: (errInfo) => release = errInfo?.release,
    __OnLifecycleEvent: callbacks.__OnLifecycleEvent,
    __FlushElementTree,
    _I18nResourceTranslation: callbacks._I18nResourceTranslation,
    _AddEventListener: () => {},
    renderPage: undefined,
  };
  Object.assign(mtsRealm.globalWindow, mtsGlobalThis);
  Object.defineProperty(mtsRealm.globalWindow, 'renderPage', {
    get() {
      return mtsGlobalThis.renderPage;
    },
    set(v) {
      mtsGlobalThis.renderPage = v;
      queueMicrotask(callbacks.mainChunkReady);
    },
    configurable: true,
    enumerable: true,
  });

  return mtsRealm.globalWindow as typeof globalThis & MainThreadGlobalThis;
}
