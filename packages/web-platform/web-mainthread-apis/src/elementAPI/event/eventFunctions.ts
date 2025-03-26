// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  componentIdAttribute,
  LynxEventNameToW3cByTagName,
  LynxEventNameToW3cCommon,
  lynxTagAttribute,
  W3cEventNameToLynx,
  type LynxCrossThreadEvent,
  type LynxEventType,
} from '@lynx-js/web-constants';
import {
  elementToRuntimeInfoMap,
  getElementByUniqueId,
  type MainThreadRuntime,
} from '../../MainThreadRuntime.js';
import { createCrossThreadEvent } from '../../utils/createCrossThreadEvent.js';

export function createEventFunctions(runtime: MainThreadRuntime) {
  const btsHandler = (event: Event) => {
    if (!event.currentTarget) {
      return;
    }
    const currentTarget = event.currentTarget as HTMLElement;
    const isCapture = event.eventPhase === Event.CAPTURING_PHASE;
    const lynxEventName = W3cEventNameToLynx[event.type] ?? event.type;
    const runtimeInfo = runtime[elementToRuntimeInfoMap].get(currentTarget)!;
    const hname = isCapture
      ? runtimeInfo.eventHandlerMap[lynxEventName]?.capture
        ?.handler
      : runtimeInfo.eventHandlerMap[lynxEventName]?.bind
        ?.handler;
    if (hname) {
      const crossThreadEvent = createCrossThreadEvent(
        runtime,
        event,
        lynxEventName,
      );
      const parentComponentUniqueId = runtimeInfo.parentComponentUniqueId;
      const parentComponent = runtime[getElementByUniqueId](
        Number(parentComponentUniqueId),
      )!;
      const componentId =
        parentComponent?.getAttribute(lynxTagAttribute) !== 'page'
          ? parentComponent?.getAttribute(componentIdAttribute) ?? undefined
          : undefined;
      if (componentId) {
        runtime.config.callbacks.publicComponentEvent(
          hname,
          componentId,
          crossThreadEvent,
        );
      } else {
        runtime.config.callbacks.publishEvent(
          hname,
          crossThreadEvent,
        );
      }
      return true;
    }
    return false;
  };
  const btsCatchHandler = (event: Event) => {
    const handlerTriggered = btsHandler(event);
    if (handlerTriggered) event.stopPropagation();
  };
  function __AddEvent(
    element: HTMLElement,
    eventType: LynxEventType,
    eventName: string,
    newEventHandler: string | undefined // | ((ev: LynxCrossThreadEvent) => void) | undefined,
    ,
  ) {
    eventName = eventName.toLowerCase();
    const isCatch = eventType === 'catchEvent' || eventType === 'capture-catch';
    const isCapture = eventType.startsWith('capture');
    const runtimeInfo = runtime[elementToRuntimeInfoMap].get(element)!;
    const currentHandler = isCapture
      ? runtimeInfo.eventHandlerMap[eventName]?.capture
      : runtimeInfo.eventHandlerMap[eventName]?.bind;
    const currentRegisteredHandler = isCatch ? btsCatchHandler : btsHandler;
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
  }

  function __GetEvent(
    element: HTMLElement,
    eventName: string,
    eventType: LynxEventType,
  ): string | ((ev: LynxCrossThreadEvent) => void) | undefined {
    const runtimeInfo = runtime[elementToRuntimeInfoMap].get(element)!;
    eventName = eventName.toLowerCase();
    const isCapture = eventType.startsWith('capture');
    const handler = isCapture
      ? runtimeInfo.eventHandlerMap[eventName]?.capture
      : runtimeInfo.eventHandlerMap[eventName]?.bind;
    return handler?.handler;
  }

  function __GetEvents(element: HTMLElement): {
    type: LynxEventType;
    name: string;
    function: string | ((ev: Event) => void) | undefined;
  }[] {
    const eventHandlerMap =
      runtime[elementToRuntimeInfoMap].get(element)!.eventHandlerMap;
    const eventInfos: {
      type: LynxEventType;
      name: string;
      function: string | ((ev: Event) => void) | undefined;
    }[] = [];
    for (const [lynxEventName, info] of Object.entries(eventHandlerMap)) {
      for (const atomInfo of [info.bind, info.capture]) {
        if (atomInfo) {
          for (const [type, handler] of Object.values(atomInfo)) {
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
    }
    return eventInfos;
  }

  function __SetEvents(
    element: HTMLElement,
    listeners: {
      type: LynxEventType;
      name: string;
      function: string | undefined; // ((ev: LynxCrossThreadEvent) => void) | undefined;
    }[],
  ) {
    for (
      const { type: eventType, name: lynxEventName, function: eventHandler }
        of listeners
    ) {
      __AddEvent(element, eventType, lynxEventName, eventHandler);
    }
  }
  return {
    __AddEvent,
    __GetEvent,
    __GetEvents,
    __SetEvents,
  };
}
