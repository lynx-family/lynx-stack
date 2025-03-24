import {
  OperationType,
  type ElementOperation,
} from '../types/ElementOperation.js';
import { OffscreenElement, uniqueId } from './OffscreenElement.js';
import {
  eventPhase,
  OffscreenEvent,
  propagationStopped,
} from './OffscreenEvent.js';

export const operations = Symbol('operations');
export const enableEvent = Symbol('enableEvent');
export const getElementByUniqueId = Symbol('getElementByUniqueId');
const _onEvent = Symbol('_onEvent');
const _uniqueIdInc = Symbol('uniqueIdInc');
const _uniqueIdToElement = Symbol('_uniqueIdToElement');
export class OffscreenDocument extends EventTarget {
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

  constructor(
    private _callbacks: {
      onCommit: (operations: ElementOperation[]) => void;
    },
  ) {
    super();
  }

  commit(): void {
    const currentOperations = this[operations];
    this[operations] = [];
    this._callbacks.onCommit(currentOperations);
  }

  append(element: OffscreenElement) {
    this[operations].push({
      type: OperationType.Append,
      uid: 0,
      cid: [element[uniqueId]],
    });
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

  #enabledEvents = new Set<string>();
  [enableEvent](eventType: string): void {
    if (!this.#enabledEvents.has(eventType)) {
      this[operations].push({
        type: OperationType.EnableEvent,
        eventType,
        uid: 0,
      });
    }
  }

  [_onEvent] = (
    eventType: string,
    targetUniqueId: number,
    bubbles: boolean,
  ) => {
    const target = this[getElementByUniqueId](targetUniqueId);
    if (target) {
      const bubblePath: OffscreenElement[] = [];
      let tempTarget = target;
      while (tempTarget.parentElement) {
        bubblePath.push(tempTarget.parentElement);
        tempTarget = tempTarget.parentElement;
      }
      const event = new OffscreenEvent(eventType, target);
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
}
