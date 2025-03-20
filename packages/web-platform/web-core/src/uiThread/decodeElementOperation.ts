// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ElementOperation } from '@lynx-js/web-constants';
import type { RuntimePropertyOnElement } from '../types/RuntimePropertyOnElement.js';
import {
  cssIdAttribute,
  lynxUniqueIdAttribute,
  OperationType,
  lynxRuntimeValue,
  LynxEventNameToW3cByTagName,
  LynxEventNameToW3cCommon,
  W3cEventNameToLynx,
  __lynx_timing_flag,
  lynxTagAttribute,
} from '@lynx-js/web-constants';

function getElement<T extends HTMLElement & RuntimePropertyOnElement>(
  uniqueId: number,
  uniqueIdToElement: (WeakRef<T> | undefined)[],
): T {
  const element = uniqueIdToElement[uniqueId]?.deref();
  if (element) {
    return element;
  } else {
    throw new Error(
      `[lynx-web] cannot find element with uniqueId: ${uniqueId}`,
    );
  }
}

function createElement<T extends HTMLElement & RuntimePropertyOnElement>(
  tag: string,
  uniqueId: number,
  uniqueIdToElement: (WeakRef<T> | undefined)[],
  createElementImpl: (tag: string) => T,
): T {
  const current = uniqueIdToElement[uniqueId]?.deref();
  if (current) {
    throw new Error(
      `[lynx-web] uniqueid is occupied: cannot create new element ${tag} with uniqueId: ${uniqueId}`,
    );
  }
  const element = createElementImpl(tag);
  element.setAttribute(lynxUniqueIdAttribute, uniqueId.toString());
  uniqueIdToElement[uniqueId] = new WeakRef(element);
  return element;
}

function handleHtmlEvent(event: Event) {
  const currentTarget = event.currentTarget as
    | null
    | (Element & RuntimePropertyOnElement);
  if (!currentTarget) return;
  const {
    eventHandler,
  } = currentTarget[lynxRuntimeValue];
  const lynxEventName = W3cEventNameToLynx[event.type] ?? event.type;
  const eventHandlerInfo = eventHandler[lynxEventName];
  if (eventHandlerInfo) {
    const { type: eventType, handler } = eventHandlerInfo;
    const isCatch = eventType === 'catchEvent' || eventType === 'capture-catch';
    handler(event);
    if (isCatch) {
      event.stopPropagation();
    }
  }
}

export function decodeElementOperation<
  T extends HTMLElement & RuntimePropertyOnElement,
>(
  operations: ElementOperation[],
  options: {
    uniqueIdToElement: (WeakRef<T> | undefined)[];
    uniqueIdToCssInJsRule: (WeakRef<CSSStyleRule> | undefined)[];
    createElementImpl: (tag: string) => T;
    createStyleRuleImpl: (
      uniqueId: number,
      initialStyle: string,
    ) => CSSStyleRule;
    eventHandler: {
      mtsHandler: (event: Event) => void;
      btsHandler: (event: Event) => void;
    };
  },
): T | undefined {
  const {
    uniqueIdToElement,
    uniqueIdToCssInJsRule,
    createElementImpl,
    createStyleRuleImpl,
    eventHandler,
  } = options;
  let pageElement: T | undefined;

  for (const op of operations) {
    if (op.type === OperationType.Create) {
      const element = createElement(
        op.tag,
        op.uid,
        uniqueIdToElement,
        createElementImpl,
      );
      if (typeof op.cssId === 'number') {
        element.setAttribute(cssIdAttribute, op.cssId.toString());
      }
    } else {
      const target = getElement(op.uid, uniqueIdToElement);
      switch (op.type) {
        case OperationType.Append:
          {
            const children = op.cid.map(id =>
              getElement(id, uniqueIdToElement)
            );
            target.append(...children);
          }
          break;
        case OperationType.InsertBefore:
          {
            const child = getElement(op.cid, uniqueIdToElement);
            const ref = op.ref ? getElement(op.ref, uniqueIdToElement) : null;
            target.insertBefore(child, ref);
          }
          break;
        case OperationType.Remove:
          {
            for (const kidId of op.cid) {
              const kid = getElement(kidId, uniqueIdToElement);
              target.removeChild(kid);
            }
          }
          break;
        case OperationType.Replace:
          {
            const newElements = op.nid.map(id =>
              getElement(id, uniqueIdToElement)
            );
            target.replaceWith(...newElements);
          }
          break;
        case OperationType.SetAttribute:
          {
            if (op.value === null) {
              target.removeAttribute(op.key);
            } else {
              target.setAttribute(op.key, op.value);
              if (op.key === lynxTagAttribute && op.value === 'page') {
                pageElement = target;
              }
            }
          }
          break;
        case OperationType.SwapElement:
          {
            const targetB = getElement(op.tid, uniqueIdToElement);
            const temp = document.createElement('div');
            target.replaceWith(temp);
            targetB.replaceWith(target);
            temp.replaceWith(targetB);
          }
          break;
        case OperationType.SetProperty:
          target[lynxRuntimeValue][op.key] = op.value;
          if (op.key === 'dataset') {
            if (op.value) {
              for (const [key, value] of Object.entries(op.value)) {
                if (value) {
                  target.setAttribute(`data-${key}`, value.toString());
                } else {
                  target.removeAttribute(`data-${key}`);
                }
              }
            } else {
              target[lynxRuntimeValue]['dataset'] = {};
            }
          }
          break;
        case OperationType.SetDatasetProperty:
          target[lynxRuntimeValue].dataset[op.key] = op.value;
          if (op.value) {
            target.setAttribute(`data-${op.key}`, op.value.toString());
          } else {
            target.removeAttribute(`data-${op.key}`);
          }
          break;
        case OperationType.RegisterEventHandler:
          const isMtsHandler = op.hname === null;
          const lynxEventName = op.ename.toLowerCase();
          const htmlEventName =
            LynxEventNameToW3cByTagName[target.tagName]?.[lynxEventName]
              ?? LynxEventNameToW3cCommon[lynxEventName] ?? lynxEventName;
          const currentHandlerInfo =
            target[lynxRuntimeValue].eventHandler[lynxEventName];
          if (currentHandlerInfo) {
            target.removeEventListener(htmlEventName, handleHtmlEvent);
          }
          const isCaptureEvent = op.eventType === 'capture-bind'
            || op.eventType === 'capture-catch';
          if (op.hname === undefined) {
            target[lynxRuntimeValue].eventHandler[lynxEventName] = undefined;
          } else {
            target.addEventListener(htmlEventName, handleHtmlEvent, {
              passive: true,
              capture: isCaptureEvent,
            });
            target[lynxRuntimeValue].eventHandler[lynxEventName] = {
              type: op.eventType,
              handler: isMtsHandler
                ? eventHandler.mtsHandler
                : eventHandler.btsHandler,
              hname: op.hname ?? '',
            };
          }
          break;
        case OperationType.SetStyleProperty:
          target.style.setProperty(
            op.key,
            op.value,
            op.im ? '!important' : undefined,
          );
          break;
        case OperationType.UpdateCssInJs:
          let rule = uniqueIdToCssInJsRule[op.uid]?.deref();
          if (rule) {
            rule.style.cssText = op.classStyleStr;
          } else {
            rule = createStyleRuleImpl(op.uid, op.classStyleStr);
            uniqueIdToCssInJsRule[op.uid] = new WeakRef(rule);
          }
          break;
      }
    }
  }

  return pageElement;
}
