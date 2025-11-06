// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { OperationType } from '../types/ElementOperation.js';

function emptyHandler() {
  // no-op
}
const otherPropertyNames = [
  'detail',
  'keyCode',
  'charCode',
  'elapsedTime',
  'propertyName',
  'pseudoElement',
  'animationName',
  'touches',
  'targetTouches',
  'changedTouches',
  'x',
  'y',
];
const blockList = new Set([
  'isTrusted',
  'target',
  'currentTarget',
  'type',
  'bubbles',
  'window',
  'self',
  'view',
  'srcElement',
  'eventPhase',
]);

function transferToCloneable(value: any): any {
  if (
    typeof value === 'string' || typeof value === 'number'
    || typeof value === 'boolean' || value === null || value === undefined
  ) {
    return value;
  } else if (value[Symbol.iterator]) {
    return [...value].map(transferToCloneable);
  } else if (typeof value === 'object' && !(value instanceof EventTarget)) {
    const obj: Record<string, any> = {};
    for (const key in value) {
      if (!blockList.has(key)) {
        obj[key] = transferToCloneable(value[key]);
      }
    }
    return obj;
  }
}

export function initOffscreenDocument(options: {
  shadowRoot: ShadowRoot;
  onEvent: (
    eventType: string,
    targetUniqueId: number,
    bubbles: boolean,
    otherProperties: Parameters<typeof structuredClone>[0],
  ) => void;
}) {
  const { shadowRoot, onEvent } = options;
  const enabledEvents: Set<string> = new Set();
  const uniqueIdToElement: [
    WeakRef<ShadowRoot>,
    ...(WeakRef<HTMLElement> | undefined)[],
  ] = [new WeakRef(shadowRoot)];
  const elementToUniqueId: WeakMap<HTMLElement, number> = new WeakMap();

  function _getElement(
    uniqueId: number,
  ): HTMLElement {
    const element = uniqueIdToElement[uniqueId]?.deref();
    if (element) {
      return element as HTMLElement;
    } else {
      throw new Error(
        `[lynx-web] cannot find element with uniqueId: ${uniqueId}`,
      );
    }
  }

  function _eventHandler(ev: Event) {
    if (
      ev.eventPhase !== Event.CAPTURING_PHASE && ev.currentTarget !== shadowRoot
    ) {
      return;
    }
    const target = ev.target as HTMLElement | null;
    if (target && elementToUniqueId.has(target)) {
      const targetUniqueId = elementToUniqueId.get(target)!;
      const eventType = ev.type;
      const otherProperties: Record<string, unknown> = {};
      for (const propertyName of otherPropertyNames) {
        if (propertyName in ev) {
          // @ts-expect-error
          otherProperties[propertyName] = transferToCloneable(ev[propertyName]);
        }
      }
      onEvent(eventType, targetUniqueId, ev.bubbles, otherProperties);
    }
  }

  function decodeOperation(operations: (string | number)[]) {
    if (operations.length === 0) {
      return;
    }
    let offset: number = 0;
    const {
      CreateElement,
      SetAttribute,
      RemoveAttribute,
      Append,
      Remove,
      ReplaceWith,
      InsertBefore,
      EnableEvent,
      RemoveChild,
      StyleDeclarationSetProperty,
      StyleDeclarationRemoveProperty,
      SetTextContent,
      sheetInsertRule,
      sheetRuleUpdateCssText,
    } = OperationType;
    let op: number | string | undefined;
    while ((op = operations[offset++])) {
      const uid = operations[offset++] as number;
      if (op === CreateElement) {
        const element = document.createElement(operations[offset++] as string);
        uniqueIdToElement[uid] = new WeakRef(element);
        elementToUniqueId.set(element, uid);
      } else {
        const target = _getElement(uid);
        switch (op) {
          case SetAttribute:
            {
              const key = operations[offset++] as string;
              const value = operations[offset++] as string;
              target.setAttribute(key, value);
            }
            break;
          case RemoveAttribute:
            {
              target.removeAttribute(operations[offset++] as string);
            }
            break;
          case Append:
            {
              const childrenLength = operations[offset++] as number;
              for (let i = 0; i < childrenLength; i++) {
                const id = operations[offset++] as number;
                const child = _getElement(id);
                target.appendChild(child);
              }
            }
            break;
          case Remove:
            target.remove();
            break;
          case ReplaceWith:
            {
              const childrenLength = operations[offset++] as number;
              const newChildren: HTMLElement[] = operations.slice(
                offset,
                offset + childrenLength,
              ).map((id) => _getElement(id as number));
              offset += childrenLength;
              target.replaceWith(...newChildren);
            }
            break;
          case InsertBefore:
            {
              const kid = _getElement(operations[offset++] as number);
              const refUid = operations[offset++] as number;
              const ref = refUid ? _getElement(refUid) : null;
              target.insertBefore(kid, ref);
            }
            break;
          case EnableEvent:
            const eventType = operations[offset++] as string;
            target.addEventListener(
              eventType,
              emptyHandler,
              { passive: true },
            );
            if (!enabledEvents.has(eventType)) {
              shadowRoot.addEventListener(
                eventType,
                _eventHandler,
                { passive: true, capture: true },
              );
              enabledEvents.add(eventType);
            }
            break;
          case RemoveChild:
            {
              const kid = _getElement(operations[offset++] as number);
              target.removeChild(kid);
            }
            break;
          case StyleDeclarationSetProperty:
            {
              target.style.setProperty(
                operations[offset++] as string,
                operations[offset++] as string,
                operations[offset++] as string,
              );
            }
            break;
          case StyleDeclarationRemoveProperty:
            {
              target.style.removeProperty(operations[offset++] as string);
            }
            break;
          case SetTextContent:
            target.textContent = operations[offset++] as string;
            break;
          case sheetInsertRule:
            {
              const index = operations[offset++] as number;
              const rule = operations[offset++] as string;
              (target as HTMLStyleElement).sheet!.insertRule(
                rule,
                index,
              );
            }
            break;
          case sheetRuleUpdateCssText:
            {
              const index = operations[offset++] as number;
              ((target as HTMLStyleElement).sheet!
                .cssRules[index]! as CSSStyleRule).style.cssText =
                  operations[offset++] as string;
            }
            break;
        }
      }
    }
  }

  return {
    decodeOperation,
  };
}
