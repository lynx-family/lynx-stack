import { MainThreadGlobalThis as MainThreadGlobalThisWASM } from '../dist/standard.js';
import {
  eventHandlerMapPropertyName,
  W3cEventNameToLynx,
  type FlushElementTreeOptions,
  type I18nResourceTranslationOptions,
  type QueryComponentPAPI,
  type JSRealm,
  type reportErrorEndpoint,
  type Cloneable,
  type MainThreadLynx,
  type BrowserConfig,
  type SetEventsPAPI,
  type LynxEventType,
  type AddEventPAPI,
  type publishEventEndpoint,
  type publicComponentEventEndpoint,
  type MainThreadScriptEvent,
  type RpcCallType,
  type MinimalRawEventObject,
  type EventHandlerMap,
  type GetEventPAPI,
  type GetEventsPAPI,
  type LynxTemplate,
  type MainThreadGlobalThis,
  type CreateComponentPAPI,
  cssIdAttribute,
  componentIdAttribute,
  type UpdateListInfoAttributeValue,
  type SetAttributePAPI,
  systemInfo,
} from '@lynx-js/web-constants';
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
  __UpdateListCallbacks,
} from './pureElementPAPIs.js';
import { createCrossThreadEvent } from './utils/createCrossThreadEvent.js';

export function createMainThreadGlobalThis(
  tagNameToHtmlTagMap: Record<string, string>,
  document: Document,
  rootNode: Node,
  enableCSSSelector: boolean,
  enableRemoveCSSScope: boolean,
  defaultDisplayLinear: boolean,
  defaultOverflowVisible: boolean,
  enableJSDataProcessor: boolean,
  lynxTemplate: LynxTemplate,
  browserConfig: BrowserConfig,
  globalProps: unknown,
  lynx: MainThreadLynx,
  mtsRealm: JSRealm,
  queryComponent: QueryComponentPAPI,
  publishEvent: RpcCallType<typeof publishEventEndpoint>,
  publicComponentEvent: RpcCallType<typeof publicComponentEventEndpoint>,
  onLifecycleEvent: (lifeCycleEvent: Cloneable) => void,
  _ReportError: RpcCallType<typeof reportErrorEndpoint>,
  _I18nResourceTranslation: (
    options: I18nResourceTranslationOptions,
  ) => unknown | undefined,
  flushElementTree: (
    options: FlushElementTreeOptions,
    timingFlags: string[],
    exposureChangedElements: Element[],
  ) => void,
): MainThreadGlobalThis {
  let sourcemapRelease: string = '';
  const { elementTemplate, lepusCode } = lynxTemplate;
  const wasm = new MainThreadGlobalThisWASM(
    tagNameToHtmlTagMap,
    document,
    rootNode,
    enableCSSSelector,
    enableRemoveCSSScope,
    defaultDisplayLinear,
    defaultOverflowVisible,
    enableJSDataProcessor,
    flushElementTree,
  );
  const commonHandler = (event: Event) => {
    if (!event.currentTarget) {
      return;
    }
    const currentTarget = event.currentTarget as HTMLElement & {
      [eventHandlerMapPropertyName]?: EventHandlerMap;
    };
    const isCapture = event.eventPhase === Event.CAPTURING_PHASE;
    const lynxEventName = W3cEventNameToLynx[event.type] ?? event.type;

    const eventHandlerMap = currentTarget[eventHandlerMapPropertyName] as
      | EventHandlerMap
      | undefined;
    if (eventHandlerMap) {
      const hname = isCapture
        ? eventHandlerMap[lynxEventName]?.capture
          ?.handler
        : eventHandlerMap[lynxEventName]?.bind
          ?.handler;
      const crossThreadEvent = createCrossThreadEvent(
        event as MinimalRawEventObject,
        lynxEventName,
      );
      if (typeof hname === 'string') {
        const parentComponent = wasm.__GetParentComponent(
          currentTarget,
        );
        const pageElement = wasm.__GetPageElement();
        if (parentComponent && pageElement) {
          const isPageElement = parentComponent && pageElement;
          const componentId = isPageElement
            ? parentComponent?.getAttribute(componentIdAttribute) ?? undefined
            : undefined;

          if (componentId) {
            publicComponentEvent(
              componentId,
              hname,
              crossThreadEvent,
            );
          } else {
            publishEvent(
              hname,
              crossThreadEvent,
            );
          }
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
  const __CreateComponent: CreateComponentPAPI = (
    componentParentUniqueID: number,
    componentID: string,
    cssID: number,
    _: unknown,
    name: string,
  ) => {
    const component = wasm.__CreateView(componentParentUniqueID);
    component.setAttribute(cssIdAttribute, cssID + '');
    component.setAttribute(componentIdAttribute, componentID);
    component.setAttribute('name', name);
    return component;
  };

  const __SetAttribute: SetAttributePAPI = (
    element: Element,
    key: string,
    value: string | UpdateListInfoAttributeValue | number | null | undefined,
  ) => {
    value == null
      ? element.removeAttribute(key)
      : element.setAttribute(key, value + '');
    wasm.__wasm_setAttribute(element, key, value);
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
    const eventHandlerMap = element[eventHandlerMapPropertyName] ?? {};
    const currentHandler = isCapture
      ? eventHandlerMap[eventName]?.capture
      : eventHandlerMap[eventName]?.bind;
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
          __SetAttribute(element, 'exposure-id', null);
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
      if (!eventHandlerMap[eventName]) {
        eventHandlerMap[eventName] = {
          capture: undefined,
          bind: undefined,
        };
      }
      if (isCapture) {
        eventHandlerMap[eventName]!.capture = info;
      } else {
        eventHandlerMap[eventName]!.bind = info;
      }
    }
    element[eventHandlerMapPropertyName] = eventHandlerMap;
  };
  const __GetEvent: GetEventPAPI = (
    element,
    eventName,
    eventType,
  ) => {
    const eventHandlerMap = element[eventHandlerMapPropertyName];
    if (eventHandlerMap) {
      eventName = eventName.toLowerCase();
      const isCapture = eventType.startsWith('capture');
      const handler = isCapture
        ? eventHandlerMap[eventName]?.capture
        : eventHandlerMap[eventName]?.bind;
      return handler?.handler;
    } else {
      return undefined;
    }
  };

  const __GetEvents: GetEventsPAPI = (element) => {
    const eventHandlerMap = element[eventHandlerMapPropertyName];
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
  const mtsGlobalThisImpl: MainThreadGlobalThis = {
    __CreateComponent,
    __CreateList: wasm.__CreateList.bind(wasm),
    __SetAttribute,
    __CreateElement: wasm.__CreateElement.bind(wasm),
    __CreateView: wasm.__CreateView.bind(wasm),
    __CreateText: wasm.__CreateText.bind(wasm),
    __CreateRawText: wasm.__CreateRawText.bind(wasm),
    __CreateImage: wasm.__CreateImage.bind(wasm),
    __CreateScrollView: wasm.__CreateScrollView.bind(wasm),
    __CreateWrapperElement: wasm.__CreateWrapperElement.bind(wasm),
    __CreatePage: wasm.__CreatePage.bind(wasm),
    __SwapElement: wasm.__SwapElement.bind(wasm),
    __GetPageElement: wasm.__GetPageElement.bind(wasm),
    __FlushElementTree: wasm.__FlushElementTree.bind(wasm),
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
    __AddEvent,
    __GetEvent,
    __GetEvents,
    __SetEvents,
    __GetConfig: __GetElementConfig,
    __UpdateListCallbacks,
    __LoadLepusChunk,
    SystemInfo: {
      ...systemInfo,
      ...browserConfig,
    },
    __globalProps: globalProps,
    __OnLifecycleEvent: onLifecycleEvent,
    _ReportError: (err, _) => _ReportError(err, _, sourcemapRelease),
    _SetSourceMapRelease: (errInfo) =>
      sourcemapRelease = errInfo?.release ?? '',
    _AddEventListener: () => {},
    __QueryComponent: queryComponent,
    _I18nResourceTranslation,
    renderPage: undefined,
    lynx,
  };
  return mtsGlobalThisImpl;
}
