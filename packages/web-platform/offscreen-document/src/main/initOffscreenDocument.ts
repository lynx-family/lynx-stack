// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  OperationType,
  type ElementOperation,
} from '../types/ElementOperation.js';

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

  function decodeOperation(operations: ElementOperation[]) {
    for (const op of operations) {
      if (op.type === OperationType.CreateElement) {
        const element = document.createElement(op.tag);
        uniqueIdToElement[op.uid] = new WeakRef(element);
        elementToUniqueId.set(element, op.uid);
      } else {
        const target = _getElement(op.uid);
        switch (op.type) {
          case OperationType.SetAttribute:
            target.setAttribute(op.key, op.value);
            break;
          case OperationType.RemoveAttribute:
            target.removeAttribute(op.key);
            break;
          case OperationType.Append:
            {
              const children = op.cid.map(id => _getElement(id));
              target.append(...children);
            }
            break;
          case OperationType.Remove:
            target.remove();
            break;
          case OperationType.ReplaceWith:
            const newChildren = op.nid.map(id => _getElement(id));
            target.replaceWith(...newChildren);
            break;
          case OperationType.InsertBefore:
            {
              const kid = _getElement(op.cid);
              const ref = op.ref ? _getElement(op.ref) : null;
              target.insertBefore(kid, ref);
            }
            break;
          case OperationType.EnableEvent:
            target.addEventListener(
              op.eventType,
              emptyHandler,
              { passive: true },
            );
            if (!enabledEvents.has(op.eventType)) {
              shadowRoot.addEventListener(
                op.eventType,
                _eventHandler,
                { passive: true, capture: true },
              );
              enabledEvents.add(op.eventType);
            }
            break;
          case OperationType.RemoveChild:
            {
              const kid = _getElement(op.cid);
              target.removeChild(kid);
            }
            break;
          case OperationType.StyleDeclarationSetProperty:
            {
              target.style.setProperty(op.property, op.value, op.priority);
            }
            break;
          case OperationType.StyleDeclarationRemoveProperty:
            {
              target.style.removeProperty(op.property);
            }
            break;
          case OperationType.SetInnerHTML:
            target.innerHTML = op.text;
            break;
        }
      }
    }
  }

  return {
    decodeOperation,
  };
}
