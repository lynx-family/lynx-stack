/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/

/**
 * Any Lynx Element, such as `view`, `text`, `image`, etc.
 *
 * {@link https://lynxjs.org/living-spec/index.html?ts=1743416098203#element%E2%91%A0 | Lynx Spec Reference}
 *
 * @public
 */
export interface LynxElement extends HTMLElement {
  /**
   * The unique id of the element.
   *
   * @internal
   */
  $$uiSign: number;
  /**
   * The unique id of the parent of the element.
   *
   * @internal
   */
  parentComponentUniqueId: number;
  /**
   * The map of events bound to the element.
   */
  eventMap?: {
    [key: string]: any;
  };
  /**
   * The gestures bound to the element.
   */
  gesture?: {
    [key: string]: any;
  };
  /**
   * The cssId of the element
   */
  cssId?: string;
  /**
   * Returns the first child.
   *
   * {@link https://developer.mozilla.org/docs/Web/API/Node/firstChild | MDN Reference}
   */
  firstChild: LynxElement;
  /**
   * Returns the next sibling.
   *
   * {@link https://developer.mozilla.org/docs/Web/API/Node/nextSibling | MDN Reference}
   */
  nextSibling: LynxElement;
  /**
   * Returns the parent.
   *
   * {@link https://developer.mozilla.org/docs/Web/API/Node/parentNode | MDN Reference}
   */
  parentNode: LynxElement;
}
/**
 * @public
 */
export const initElementTree = () => {
  let uiSignNext = 0;
  const uniqueId2Element = new Map<number, LynxElement>();

  return new (class ElementTree {
    root: LynxElement | undefined;
    countElement(
      element: LynxElement,
      parentComponentUniqueId: number,
    ) {
      element.$$uiSign = uiSignNext++;
      uniqueId2Element.set(element.$$uiSign, element);
      element.parentComponentUniqueId = parentComponentUniqueId;
    }
    __CreatePage(_tag: string, parentComponentUniqueId: number) {
      const page = this.__CreateElement('page', parentComponentUniqueId);
      this.root = page;
      lynxEnv.jsdom.window.document.body.appendChild(page);
      return page;
    }

    __CreateRawText(text: string): LynxElement {
      const element = lynxEnv.jsdom.window.document.createTextNode(
        text,
      ) as unknown as LynxElement;
      this.countElement(element, 0);

      return element;
    }

    __GetElementUniqueID(e: LynxElement): number {
      return e.$$uiSign;
    }

    __SetClasses(e: LynxElement, cls: string) {
      e.className = cls;
    }

    __CreateElement(
      tag: string,
      parentComponentUniqueId: number,
    ): LynxElement {
      if (tag === 'raw-text') {
        return this.__CreateRawText('');
      }

      const element = lynxEnv.jsdom.window.document.createElement(
        tag,
      ) as LynxElement;
      this.countElement(element, parentComponentUniqueId);
      return element;
    }

    __CreateView(parentComponentUniqueId: number) {
      return this.__CreateElement('view', parentComponentUniqueId);
    }
    __CreateScrollView(parentComponentUniqueId: number) {
      return this.__CreateElement('scroll-view', parentComponentUniqueId);
    }
    __FirstElement(e: LynxElement) {
      return e.firstChild;
    }

    __CreateText(parentComponentUniqueId: number) {
      return this.__CreateElement('text', parentComponentUniqueId);
    }

    __CreateImage(parentComponentUniqueId: number) {
      return this.__CreateElement('image', parentComponentUniqueId);
    }

    __CreateWrapperElement(parentComponentUniqueId: number) {
      return this.__CreateElement('wrapper', parentComponentUniqueId);
    }

    __AddInlineStyle(e: HTMLElement, key: number, value: string) {
      e.style[key] = value;
    }

    __AppendElement(parent: LynxElement, child: LynxElement) {
      parent.appendChild(child);
    }

    __SetCSSId(
      e: LynxElement | LynxElement[],
      id: string,
      entryName?: string,
    ) {
      const cssId = `${entryName ?? '__Card__'}:${id}`;
      if (Array.isArray(e)) {
        e.forEach(item => {
          item.cssId = cssId;
        });
      } else {
        e.cssId = cssId;
      }
    }

    __SetAttribute(e: LynxElement, key: string, value: any) {
      if (
        key === 'style'
        || key === 'class'
        || key === 'className'
        || key === 'key'
        || key === 'id'
        || key === 'ref'
        || (/^data-/.exec(key))
        || (/^(bind|catch|global-bind|capture-bind|capture-catch)[A-Za-z]/.exec(
          key,
        ))
      ) {
        throw new Error(`Cannot use __SetAttribute for "${key}"`);
      }

      if (key === 'update-list-info') {
        let listInfoStr = e.getAttribute(key);
        let listInfo = listInfoStr ? JSON.parse(listInfoStr) : [];
        listInfo.push(value);

        e.setAttribute(key, JSON.stringify(listInfo));
        return;
      }

      if (key === 'text') {
        e.textContent = value;
        return;
      }

      if (value === null) {
        e.removeAttribute(key);
        return;
      }
      if (typeof value === 'string') {
        e.setAttribute(key, value);
        return;
      } else {
        e.setAttribute(key, JSON.stringify(value));
        return;
      }
    }

    __AddEvent(
      e: LynxElement,
      eventType: string,
      eventName: string,
      eventHandler: string | Record<string, any>,
    ) {
      if (e.eventMap?.[`${eventType}:${eventName}`]) {
        e.removeEventListener(
          `${eventType}:${eventName}`,
          e.eventMap[`${eventType}:${eventName}`],
        );
        delete e.eventMap[`${eventType}:${eventName}`];
      }
      if (typeof eventHandler === 'undefined') {
        return;
      }
      if (
        typeof eventHandler !== 'string' && eventHandler['type'] === undefined
      ) {
        throw new Error(`event must be string, but got ${typeof eventHandler}`);
      }

      const listener: EventListenerOrEventListenerObject = (evt) => {
        if (
          typeof eventHandler === 'object' && eventHandler['type'] === 'worklet'
        ) {
          const isBackground = !__MAIN_THREAD__;
          globalThis.lynxEnv.switchToMainThread();

          // Use Object.assign to convert evt to plain object to avoid infinite transformWorkletInner
          // @ts-ignore
          runWorklet(eventHandler.value, [Object.assign({}, evt)]);

          if (isBackground) {
            globalThis.lynxEnv.switchToBackgroundThread();
          }
        } else {
          // stop the propagation of the event
          if (eventType === 'catchEvent' || eventType === 'capture-catch') {
            evt.stopPropagation();
          }
          // @ts-ignore
          globalThis.lynxCoreInject.tt.publishEvent(eventHandler, evt);
        }
      };
      e.eventMap = e.eventMap ?? {};
      e.eventMap[`${eventType}:${eventName}`] = listener;
      e.addEventListener(
        `${eventType}:${eventName}`,
        listener,
        {
          // listening at capture stage
          capture: eventType === 'capture-bind'
            || eventType === 'capture-catch',
        },
      );
    }

    __GetEvent(e: LynxElement, eventType: string, eventName: string) {
      const jsFunction = e.eventMap?.[`${eventType}:${eventName}`];
      if (typeof jsFunction !== 'undefined') {
        return {
          type: eventType,
          name: eventName,
          jsFunction,
        };
      }
      return undefined;
    }

    __SetID(e: LynxElement, id: string) {
      e.id = id;
    }

    __SetInlineStyles(
      e: LynxElement,
      styles: string | Record<string, string>,
    ) {
      if (typeof styles === 'string') {
        e.style.cssText = styles;
      } else {
        Object.assign(e.style, styles);
      }
    }

    __AddDataset(e: LynxElement, key: string, value: string) {
      e.dataset[key] = value;
    }

    __SetDataset(e: LynxElement, dataset: any) {
      Object.assign(e.dataset, dataset);
    }

    __SetGestureDetector(
      e: LynxElement,
      id: number,
      type: number,
      config: any,
      relationMap: Record<string, number[]>,
    ) {
      e.gesture = {
        id,
        type,
        config,
        relationMap,
      };
    }

    __GetDataset(e: LynxElement) {
      return e.dataset;
    }

    __RemoveElement(parent: LynxElement, child: LynxElement) {
      let ch = parent.firstChild;
      while (ch) {
        if (ch === child) {
          parent.removeChild(ch);
          break;
        }
      }
    }

    __InsertElementBefore(
      parent: LynxElement,
      child: LynxElement,
      ref?: LynxElement,
    ) {
      if (typeof ref === 'undefined') {
        parent.appendChild(child);
      } else {
        parent.insertBefore(child, ref);
      }
    }

    __ReplaceElement(
      newElement: LynxElement,
      oldElement: LynxElement,
    ) {
      const parent = oldElement.parentNode;
      if (!parent) {
        throw new Error('unreachable');
      }
      parent.replaceChild(newElement, oldElement);
    }

    __FlushElementTree(): void {}

    __UpdateListComponents(_list: LynxElement, _components: string[]) {}

    __UpdateListCallbacks(
      list: LynxElement,
      componentAtIndex: (
        list: LynxElement,
        listID: number,
        cellIndex: number,
        operationID: number,
        enable_reuse_notification: boolean,
      ) => void,
      enqueueComponent: (
        list: LynxElement,
        listID: number,
        sign: number,
      ) => void,
    ): void {
      Object.defineProperties(list, {
        componentAtIndex: {
          enumerable: false,
          configurable: true,
          value: componentAtIndex,
        },
        enqueueComponent: {
          enumerable: false,
          configurable: true,
          value: enqueueComponent,
        },
      });
    }

    __CreateList(
      parentComponentUniqueId: number,
      componentAtIndex: any,
      enqueueComponent: any,
    ) {
      const e = this.__CreateElement('list', parentComponentUniqueId);

      Object.defineProperties(e, {
        componentAtIndex: {
          enumerable: false,
          configurable: true,
          value: componentAtIndex,
        },
        enqueueComponent: {
          enumerable: false,
          configurable: true,
          value: enqueueComponent,
        },
      });

      return e;
    }

    __GetTag(ele: LynxElement) {
      return ele.nodeName;
    }

    __GetAttributeByName(ele: LynxElement, name: string) {
      // return ele.props[name];
      return ele.getAttribute(name);
    }

    clear() {
      this.root = undefined;
    }

    toTree() {
      return this.root;
    }

    /**
     * Enter a list-item element at the given index.
     * It will load the list-item element using the `componentAtIndex` callback.
     *
     * @param e - The list element
     * @param index - The index of the list-item element
     * @param args - The arguments used to create the list-item element
     * @returns The unique id of the list-item element
     */
    enterListItemAtIndex(
      e: LynxElement,
      index: number,
      ...args: any[]
    ): number {
      // @ts-ignore
      const { componentAtIndex, $$uiSign } = e;
      return componentAtIndex(e, $$uiSign, index, ...args);
    }

    /**
     * Leave a list-item element.
     * It will mark the list-item element as unused using
     * the `enqueueComponent` callback, and the list-item element
     * will be reused in the future by other list-item elements.
     *
     * @param e - The list element
     * @param uiSign - The unique id of the list-item element
     */
    leaveListItem(e: LynxElement, uiSign: number) {
      // @ts-ignore
      const { enqueueComponent, $$uiSign } = e;
      enqueueComponent(e, $$uiSign, uiSign);
    }

    toJSON() {
      return this.toTree();
    }
    __GetElementByUniqueId(uniqueId: number) {
      return uniqueId2Element.get(uniqueId);
    }
  })();
};
