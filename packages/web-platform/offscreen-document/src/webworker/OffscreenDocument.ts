// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  OperationType,
  type ElementOperation,
} from '../types/ElementOperation.js';
import { styleMapSymbol } from './OffscreenCSSStyleDeclaration.js';
import {
  _attributes,
  innerHTML,
  OffscreenElement,
} from './OffscreenElement.js';
import {
  eventPhase,
  OffscreenEvent,
  propagationStopped,
} from './OffscreenEvent.js';
import { OffscreenNode, uniqueId } from './OffscreenNode.js';

export const operations = Symbol('operations');
export const enableEvent = Symbol('enableEvent');
export const getElementByUniqueId = Symbol('getElementByUniqueId');
export const _onEvent = Symbol('_onEvent');
const _uniqueIdInc = Symbol('uniqueIdInc');
const _uniqueIdToElement = Symbol('_uniqueIdToElement');
export class OffscreenDocument extends OffscreenNode {
  /**
   * @private
   */
  [_uniqueIdInc] = 1;

  /**
   * @private
   */
  [_uniqueIdToElement]: WeakRef<OffscreenElement>[] = [];

  /**
   * @private
   */
  [operations]: ElementOperation[] = [];

  /**
   * @private
   * @param uniqueId
   * @returns
   */
  [getElementByUniqueId](uniqueId: number): OffscreenElement | undefined {
    return this[_uniqueIdToElement][uniqueId]?.deref();
  }

  [enableEvent]: (eventType: string, uid: number) => void;
  constructor(
    private _callbacks: {
      onCommit: (operations: ElementOperation[]) => void;
    },
  ) {
    const enableEventImpl: (nm: string, uid: number) => void = (
      eventType,
      uid,
    ) => {
      this[operations].push({
        type: OperationType.EnableEvent,
        eventType,
        uid,
      });
    };
    super(0, enableEventImpl);
    this[enableEvent] = enableEventImpl;
  }

  commit(): void {
    const currentOperations = this[operations];
    this[operations] = [];
    this._callbacks.onCommit(currentOperations);
  }

  override append(element: OffscreenElement) {
    this[operations].push({
      type: OperationType.Append,
      uid: 0,
      cid: [element[uniqueId]],
    });
    super.append(element);
  }

  createElement(tagName: string): OffscreenElement {
    const uniqueId = this[_uniqueIdInc]++;
    const element = new OffscreenElement(tagName, this, uniqueId);
    this[_uniqueIdToElement][uniqueId] = new WeakRef(element);
    this[operations].push({
      type: OperationType.CreateElement,
      uid: uniqueId,
      tag: tagName,
    });
    return element;
  }

  [_onEvent] = (
    eventType: string,
    targetUniqueId: number,
    bubbles: boolean,
    otherProperties: Parameters<typeof structuredClone>[0],
  ) => {
    const target = this[getElementByUniqueId](targetUniqueId);
    if (target) {
      const bubblePath: OffscreenNode[] = [];
      let tempTarget: OffscreenNode = target;
      while (tempTarget.parentElement) {
        bubblePath.push(tempTarget.parentElement);
        tempTarget = tempTarget.parentElement;
      }
      const event = new OffscreenEvent(eventType, target);
      Object.assign(event, otherProperties);
      // capture phase
      event[eventPhase] = Event.CAPTURING_PHASE;
      for (let ii = bubblePath.length - 1; ii >= 0; ii--) {
        const currentPhaseTarget = bubblePath[ii]!;
        currentPhaseTarget.dispatchEvent(event);
        if (event[propagationStopped]) {
          return;
        }
      }
      // target phase
      event[eventPhase] = Event.AT_TARGET;
      target.dispatchEvent(event);
      // bubble phase
      if (bubbles) {
        event[eventPhase] = Event.BUBBLING_PHASE;
        for (const currentPhaseTarget of bubblePath) {
          currentPhaseTarget.dispatchEvent(event);
          if (event[propagationStopped]) {
            return;
          }
        }
      }
    }
  };
  /**
   * Converts the OffscreenDocument instance to a JSON string.
   * Currently, this method returns an empty string as a placeholder.
   * This behavior may be updated in the future to provide a meaningful
   * JSON representation of the OffscreenDocument.
   *
   * @returns {string} An empty string.
   */
  toJSON(): string {
    return '';
  }
}

type ShadowrootTemplates =
  | ((
    attributes: Record<string, string>,
  ) => string)
  | string;

function getInnerHTMLImpl(
  buffer: string[],
  element: OffscreenElement,
  shadowrootTemplates: Record<string, ShadowrootTemplates>,
): void {
  let tagName = element.tagName.toLowerCase();
  buffer.push('<');
  buffer.push(tagName);
  for (const [key, value] of Object.entries(element[_attributes])) {
    buffer.push(' ');
    buffer.push(key);
    buffer.push('="');
    buffer.push(value);
    buffer.push('"');
  }

  const cssText = Array.from(element.style[styleMapSymbol].entries())
    .map(([key, value]) => `${key}: ${value};`).join('');
  if (cssText) {
    buffer.push(' style="', cssText, '"');
  }

  buffer.push('>');
  const templateImpl = shadowrootTemplates[tagName];
  if (templateImpl) {
    const template = typeof templateImpl === 'function'
      ? templateImpl(element[_attributes])
      : templateImpl;
    buffer.push('<template shadowrootmode="open">', template, '</template>');
  }
  if (element[innerHTML]) {
    buffer.push(element[innerHTML]);
  } else {
    for (const child of element.children) {
      getInnerHTMLImpl(
        buffer,
        child as OffscreenElement,
        shadowrootTemplates,
      );
    }
  }
  buffer.push('</');
  buffer.push(tagName);
  buffer.push('>');
}

export function dumpHTMLString(
  element: OffscreenDocument,
  shadowrootTemplates: Record<string, ShadowrootTemplates>,
): string {
  const buffer: string[] = [];
  for (const child of element.children) {
    getInnerHTMLImpl(
      buffer,
      child as OffscreenElement,
      shadowrootTemplates,
    );
  }
  return buffer.join('');
}
