// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  type LynxTemplate,
  type PageConfig,
  type StyleInfo,
  type FlushElementTreeOptions,
  type Cloneable,
  type CssInJsInfo,
  type BrowserConfig,
  lynxUniqueIdAttribute,
  type publishEventEndpoint,
  type publicComponentEventEndpoint,
  type reportErrorEndpoint,
  type RpcCallType,
  type LynxContextEventTarget,
  type LynxJSModule,
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
  type GetTemplatePartsPAPI,
  type GetPageElementPAPI,
  type MinimalRawEventObject,
  type I18nResourceTranslationOptions,
} from '@lynx-js/web-constants';
import { globalMuteableVars } from '@lynx-js/web-constants';
import { createMainThreadLynx } from './createMainThreadLynx.js';
import {
  flattenStyleInfo,
  genCssContent,
  genCssInJsInfo,
  transformToWebCss,
} from './utils/processStyleInfo.js';
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
  __InsertElementBefore,
  __LastElement,
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
} from './pureElementPAPIs.js';
import { createCrossThreadEvent } from './utils/createCrossThreadEvent.js';
import { decodeCssInJs } from './utils/decodeCssInJs.js';

export interface MainThreadRuntimeCallbacks {
  mainChunkReady: () => void;
  flushElementTree: (
    options: FlushElementTreeOptions,
    timingFlags: string[],
  ) => void;
  _ReportError: RpcCallType<typeof reportErrorEndpoint>;
  __OnLifecycleEvent: (lifeCycleEvent: Cloneable) => void;
  markTiming: (pipelineId: string, timingKey: string) => void;
  publishEvent: RpcCallType<typeof publishEventEndpoint>;
  publicComponentEvent: RpcCallType<typeof publicComponentEventEndpoint>;
  createElement: (tag: string) => WebFiberElementImpl;
  _I18nResourceTranslation: (
    options: I18nResourceTranslationOptions,
  ) => unknown | undefined;
}

export interface MainThreadRuntimeConfig {
  pageConfig: PageConfig;
  globalProps: unknown;
  callbacks: MainThreadRuntimeCallbacks;
  styleInfo: StyleInfo;
  customSections: LynxTemplate['customSections'];
  lepusCode: Record<string, LynxJSModule>;
  browserConfig: BrowserConfig;
  tagMap: Record<string, string>;
  rootDom: Pick<Element, 'append' | 'addEventListener'>;
  jsContext: LynxContextEventTarget;
}

export function createMainThreadGlobalThis(
  config: MainThreadRuntimeConfig,
): MainThreadGlobalThis {
  let pageElement!: WebFiberElementImpl;
  let uniqueIdInc = 1;
  let timingFlags: string[] = [];
  let renderPage: MainThreadGlobalThis['renderPage'];
  const {
    callbacks,
    tagMap,
    pageConfig,
    lepusCode,
    rootDom,
    globalProps,
    styleInfo,
  } = config;
  const lynxUniqueIdToElement: WeakRef<WebFiberElementImpl>[] = [];
  const elementToRuntimeInfoMap: WeakMap<WebFiberElementImpl, LynxRuntimeInfo> =
    new WeakMap();
  const lynxUniqueIdToStyleRulesIndex: number[] = [];
  /**
   * for "update" the globalThis.val in the main thread
   */
  const varsUpdateHandlers: (() => void)[] = [];
  const lynxGlobalBindingValues: Record<string, any> = {};

  /**
   * now create the style content
   * 1. flatten the styleInfo
   * 2. transform the styleInfo to web css
   * 3. generate the css in js info
   * 4. create the style element
   * 5. append the style element to the root dom
   */
  flattenStyleInfo(
    styleInfo,
    pageConfig.enableCSSSelector,
  );
  transformToWebCss(styleInfo);
  const cssInJsInfo: CssInJsInfo = pageConfig.enableCSSSelector
    ? {}
    : genCssInJsInfo(styleInfo);
  const cardStyleElement = callbacks.createElement('style');
  cardStyleElement.innerHTML = genCssContent(
    styleInfo,
    pageConfig,
  );
  // @ts-expect-error
  rootDom.append(cardStyleElement);
  const cardStyleElementSheet =
    (cardStyleElement as unknown as HTMLStyleElement).sheet!;
  const updateCSSInJsStyle: (
    uniqueId: number,
    newStyles: string,
  ) => void = (uniqueId, newStyles) => {
    if (lynxUniqueIdToStyleRulesIndex[uniqueId] !== undefined) {
      const rule = cardStyleElementSheet
        .cssRules[lynxUniqueIdToStyleRulesIndex[uniqueId]] as CSSStyleRule;
      rule.style.cssText = newStyles;
    } else {
      const index = cardStyleElementSheet.insertRule(
        `[${lynxUniqueIdAttribute}="${uniqueId}"]{${newStyles}}`,
        cardStyleElementSheet.cssRules.length,
      );
      lynxUniqueIdToStyleRulesIndex[uniqueId] = index;
    }
  };

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
        mtsGlobalThis.runWorklet?.(hname.value, [crossThreadEvent]);
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
    const element = callbacks.createElement(htmlTag);
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
    const temp = callbacks.createElement('div');
    childA.replaceWith(temp);
    childB.replaceWith(childA);
    temp.replaceWith(childB);
  };

  const __SetCSSIdForCSSOG: SetCSSIdPAPI = (
    elements,
    cssId,
  ) => {
    for (const element of elements) {
      element.setAttribute(cssIdAttribute, cssId + '');
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
    const newStyleStr = decodeCssInJs(
      newClassName,
      cssInJsInfo,
      element.getAttribute(cssIdAttribute),
    );
    updateCSSInJsStyle(
      Number(element.getAttribute(lynxUniqueIdAttribute)),
      newStyleStr,
    );
  };

  const __SetClassesForCSSOG: SetClassesPAPI = (
    element,
    classNames,
  ) => {
    __SetClasses(element, classNames);
    const newStyleStr = decodeCssInJs(
      classNames ?? '',
      cssInJsInfo,
      element.getAttribute(cssIdAttribute),
    );
    updateCSSInJsStyle(
      Number(element.getAttribute(lynxUniqueIdAttribute)),
      newStyleStr ?? '',
    );
  };

  const __LoadLepusChunk: (path: string) => boolean = (path) => {
    const lepusModule = lepusCode[`${path}`];
    if (lepusModule) {
      const entry = lepusModule.exports;
      entry?.(mtsGlobalThis);
      return true;
    } else {
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
    if (pageElement && !pageElement.parentNode) {
      // @ts-expect-error
      rootDom.append(pageElement);
    }
    callbacks.flushElementTree(options, timingFlagsCopied);
  };

  const __GetTemplateParts: GetTemplatePartsPAPI = () => {
    return undefined;
  };

  const __GetPageElement: GetPageElementPAPI = () => {
    return pageElement;
  };

  let release = '';
  const isCSSOG = !pageConfig.enableCSSSelector;
  const mtsGlobalThis: MainThreadGlobalThis = {
    __AddEvent,
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
    __GetClasses,
    __AddClass: isCSSOG ? __AddClassForCSSOG : __AddClass,
    __SetClasses: isCSSOG ? __SetClassesForCSSOG : __SetClasses,
    __AddInlineStyle,
    __SetCSSId: isCSSOG ? __SetCSSIdForCSSOG : __SetCSSId,
    __SetInlineStyles,
    __LoadLepusChunk,
    __GetPageElement,
    __GetTemplateParts,
    __globalProps: globalProps,
    SystemInfo: {
      ...systemInfo,
      ...config.browserConfig,
    },
    lynx: createMainThreadLynx(config),
    _ReportError: (err, _) => callbacks._ReportError(err, _, release),
    _SetSourceMapRelease: (errInfo) => release = errInfo?.release,
    __OnLifecycleEvent: callbacks.__OnLifecycleEvent,
    __FlushElementTree,
    __lynxGlobalBindingValues: lynxGlobalBindingValues,
    _I18nResourceTranslation: callbacks._I18nResourceTranslation,
    _AddEventListener: () => {},
    set _updateVars(handler: () => void) {
      varsUpdateHandlers.push(handler);
    },
    set renderPage(foo: (data: unknown) => void) {
      renderPage = foo;
      queueMicrotask(callbacks.mainChunkReady);
    },
    get renderPage() {
      return renderPage!;
    },
  };
  mtsGlobalThis.globalThis = new Proxy(mtsGlobalThis, {
    get: (target, prop) => {
      if (prop === 'globalThis') {
        return target;
      }
      // @ts-expect-error
      return target[prop] ?? globalThis[prop];
    },
    set: (target, prop, value) => {
      // @ts-expect-error
      target[prop] = value;
      return true;
    },
    ownKeys(target) {
      return Reflect.ownKeys(target).filter((key) => key !== 'globalThis');
    },
  });

  for (const nm of globalMuteableVars) {
    Object.defineProperty(mtsGlobalThis, nm, {
      get: () => {
        return lynxGlobalBindingValues[nm];
      },
      set: (v: any) => {
        lynxGlobalBindingValues[nm] = v;
        for (const handler of varsUpdateHandlers) {
          handler();
        }
      },
    });
  }

  return mtsGlobalThis;
}
