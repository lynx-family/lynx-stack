/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { format as prettyFormat, plugins } from 'pretty-format';
import { parse as parseSelector } from 'css-what';
const { ReactTestComponent } = plugins;

export interface LynxFiberElement {
  type: string;
  props: any;
  children: any[];
  parent?: LynxFiberElement | null;
  getRootNode: () => LynxFiberElement;
  parentComponentUniqueId?: number;
  $$uiSign: number;
  nodeType: number;
}

function matchElement(element: LynxFiberElement, selector: any): boolean {
  if (selector.type === 'tag' && element.type !== selector.name) {
    return false;
  }
  if (selector.type === 'attribute') {
    let attrValue;
    if (selector.name.startsWith('data-')) {
      const key = selector.name.slice(5);
      attrValue = element.props?.dataset?.[key];
    } else {
      attrValue = element.props?.[selector.name];
    }

    if (attrValue === undefined) return false;
    if (selector.action === 'exists') return true;
    if (selector.action === 'equals') return attrValue === selector.value;
    if (selector.action === 'includes') {
      return attrValue?.includes?.(selector.value);
    }
    if (selector.action === 'dash') {
      return attrValue?.startsWith?.(`${selector.value}-`);
    }
    if (selector.action === 'not') return attrValue !== selector.value;
  }
  return true;
}

function matchSelectors(
  element: LynxFiberElement,
  selectors: any[][],
): boolean {
  return selectors.some((group) =>
    group.every((selector) => matchElement(element, selector))
  );
}
function injectDOMMethods(element: LynxFiberElement) {
  // This is required by @lynx-js/testing-library-lynx-dom to implement `findBy*` queries.
  // It's not a perfect implementation, but it's good enough for now.
  // TODO: implement a better implementation.
  Object.defineProperty(element, 'querySelector', {
    value: function(selector: string): LynxFiberElement | null {
      const selectors = parseSelector(selector);

      function traverse(node: LynxFiberElement): LynxFiberElement | null {
        if (matchSelectors(node, selectors)) {
          return node;
        }
        for (const child of node.children || []) {
          if (typeof child === 'object') {
            const found = traverse(child);
            if (found) return found;
          }
        }
        return null;
      }

      let ans = traverse(this);
      return ans;
    },
  });
  Object.defineProperty(element, 'querySelectorAll', {
    value: function(selector: string): LynxFiberElement[] {
      const selectors = parseSelector(selector);
      const result: LynxFiberElement[] = [];

      function traverse(node: LynxFiberElement) {
        if (matchSelectors(node, selectors)) {
          result.push(node);
        }
        for (const child of node.children || []) {
          if (typeof child === 'object') traverse(child);
        }
      }

      traverse(this);
      return result;
    },
  });
  Object.defineProperty(element, 'getAttribute', {
    value: function(name: string): any {
      if (name.startsWith('data-')) {
        const key = name.slice(5);
        return this.props?.dataset?.[key] ?? null;
      }
      return this.props[name] ?? null;
    },
  });
  Object.defineProperty(element, 'matches', {
    value: function(selectors: string): boolean {
      try {
        const selectorParts = selectors.split(',').map(s => s.trim());

        const matchesSelector = (selector: string): boolean => {
          const [tag, ...rest] = selector.split(/(?=\[|\.)/);
          const tagMatches = !tag || tag === this.type;

          const attributes = rest.filter(r => r.startsWith('['));
          const classes = rest.filter(r => r.startsWith('.')).map(c =>
            c.slice(1)
          );

          const attributesMatch = attributes.every(attr => {
            const match = attr.match(/^\[(.+?)(?:=(.+))?\]$/);
            if (!match) return false;
            const [, key, value] = match;

            if (key.startsWith('data-')) {
              // Handle dataset properties
              const datasetKey = key.slice(5).replace(
                /-([a-z])/g,
                (_, letter) => letter.toUpperCase(),
              );
              const datasetValue = this.props.dataset?.[datasetKey];
              return value
                ? datasetValue === value
                : datasetKey in this.props.dataset;
            }

            return value ? this.props[key] === value : key in this.props;
          });

          const classesMatch = classes.every(cls =>
            this.props.class?.split(' ').includes(cls)
          );

          return tagMatches && attributesMatch && classesMatch;
        };

        return selectorParts.some(matchesSelector);
      } catch (error) {
        throw new SyntaxError(`Invalid selector: ${selectors}`);
      }
    },
  });
  Object.defineProperty(element, 'textContent', {
    get: function(): string {
      const collectText = (e: LynxFiberElement): string => {
        if (!e.children || e.children.length === 0) {
          return e.type === 'raw-text' ? e.props.text : '';
        }
        return e.children.map(collectText).join(' ');
      };
      const ans = collectText(this);
      return ans;
    },
    set: function() {
      throw new Error('set textContent is not supported');
    },
  });
  Object.defineProperty(element, 'childNodes', {
    get: function(): LynxFiberElement[] {
      return this.children ?? [];
    },
  });
  Object.defineProperty(element, 'getRootNode', {
    get: function() {
      return function(this: LynxFiberElement): LynxFiberElement {
        if (!this.parent) return this;
        return this.parent.getRootNode();
      };
    },
  });
  Object.defineProperty(element, 'ownerDocument', {
    get: function(): LynxFiberElement {
      return elementTree.root;
    },
  });
  Object.defineProperty(element, 'toJSON', {
    value: function() {
      return prettyFormat(this, {
        plugins: [ReactTestComponent],
      });
    },
  });
  Object.defineProperty(element, 'dispatchEvent', {
    value: function(event: any) {
      __SendEvent(
        this,
        event.eventType || 'bindEvent',
        event.eventName,
        event,
      );
      // preventDefault is not supported, always return true
      return true;
    },
  });
  // @ts-ignore
  element.constructor = {
    name: 'LynxFiberElement',
  };
  return element;
}

export const initElementTree = () => {
  let uiSignNext = 0;
  const parentMap = new WeakMap<LynxFiberElement, LynxFiberElement>();
  const uniqueId2Element = new Map<number, LynxFiberElement>();

  return new (class ElementTree {
    root?: LynxFiberElement = undefined;

    __CreatePage(tag: string, parentComponentUniqueId: number) {
      return (this.root ??= this.__CreateElement(
        'page',
        parentComponentUniqueId,
      ));
    }

    __CreateRawText(text: string) {
      // @ts-ignore
      const json = this.__CreateElement('raw-text', 0);
      json.props.text = text;

      this.root ??= json;
      return json;
    }

    __GetElementUniqueID(e: LynxFiberElement): number {
      // @ts-ignore
      return e.$$uiSign;
    }

    __SetClasses(e: LynxFiberElement, cls: string) {
      e.props.class = cls;
    }

    __CreateElement(tag: string, parentComponentUniqueId: number) {
      // @ts-ignore
      const json = injectDOMMethods({
        type: tag,
        children: [],
        props: {},
        parentComponentUniqueId,
      });
      Object.defineProperty(json, '$$typeof', {
        value: Symbol.for('react.test.json'),
      });
      Object.defineProperty(json, '$$uiSign', {
        value: uiSignNext++,
      });
      uniqueId2Element.set(json.$$uiSign, json);
      if (tag === 'raw-text') {
        json.nodeType = 3;
      }

      this.root ??= json;
      return json;
    }

    __CreateView(parentComponentUniqueId: number) {
      return this.__CreateElement('view', parentComponentUniqueId);
    }
    __CreateScrollView(parentComponentUniqueId: number) {
      return this.__CreateElement('scroll-view', parentComponentUniqueId);
    }
    __FirstElement(e: LynxFiberElement) {
      return e.children[0];
    }

    __CreateText(parentComponentUniqueId: number) {
      // @ts-ignore
      const json = injectDOMMethods({
        type: 'text',
        children: [],
        props: {},
        parentComponentUniqueId,
      });
      Object.defineProperty(json, '$$typeof', {
        value: Symbol.for('react.test.json'),
      });
      Object.defineProperty(json, '$$uiSign', {
        value: uiSignNext++,
      });
      uniqueId2Element.set(json.$$uiSign, json);
      this.root ??= json;
      return json;
    }

    __CreateImage(parentComponentUniqueId: number) {
      // @ts-ignore
      const json = injectDOMMethods({
        type: 'image',
        children: [],
        props: {},
        parentComponentUniqueId,
      });
      Object.defineProperty(json, '$$typeof', {
        value: Symbol.for('react.test.json'),
      });
      Object.defineProperty(json, '$$uiSign', {
        value: uiSignNext++,
      });
      uniqueId2Element.set(json.$$uiSign, json);
      this.root ??= json;
      return json;
    }

    __CreateWrapperElement(parentComponentUniqueId: number) {
      return this.__CreateElement('wrapper', parentComponentUniqueId);
    }

    __AddInlineStyle(e: LynxFiberElement, key: number, value: string) {
      const style = e.props.style || {};
      style[key] = value;
      e.props.style = style;
    }

    __AppendElement(parent: LynxFiberElement, child: LynxFiberElement) {
      child.parent = parent;
      parent.children.push(child);
      parentMap.set(child, parent);
    }

    __SetCSSId(
      e: LynxFiberElement | LynxFiberElement[],
      id: string,
      entryName?: string,
    ) {
      const cssId = `${entryName ?? '__Card__'}:${id}`;
      if (Array.isArray(e)) {
        e.forEach(item => {
          item.props.cssId = cssId;
        });
      } else {
        e.props.cssId = cssId;
      }
    }

    __SetAttribute(e: LynxFiberElement, key: string, value: any) {
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
        (e.props[key] ??= []).push(value);
        return;
      }

      if (value === null) {
        delete e.props[key];
        return;
      }
      e.props[key] = value;
    }

    __AddEvent(
      e: LynxFiberElement,
      eventType: string,
      eventName: string,
      event: string | Record<string, any>,
    ) {
      if (typeof event === 'undefined') {
        if (e.props.event) {
          delete e.props.event[`${eventType}:${eventName}`];
        }
        return;
      }
      if (typeof event !== 'string' && event.type === undefined) {
        throw new Error(`event must be string, but got ${typeof event}`);
        // console.error(`event must be string, but got ${typeof event}`);
      }
      (e.props.event ??= {})[`${eventType}:${eventName}`] = event;
    }

    __GetEvent(e: LynxFiberElement, eventType: string, eventName: string) {
      const jsFunction = e.props.event?.[`${eventType}:${eventName}`];
      if (typeof jsFunction !== 'undefined') {
        return {
          type: eventType,
          name: eventName,
          jsFunction,
        };
      }
    }

    __SetID(e: LynxFiberElement, id: string) {
      e.props.id = id;
    }

    __SetInlineStyles(
      e: LynxFiberElement,
      styles: string | Record<string, string>,
    ) {
      e.props.style = styles;
    }

    __AddDataset(e: LynxFiberElement, key: string, value: string) {
      (e.props.dataset ??= {})[key] = value;
    }

    __SetDataset(e: LynxFiberElement, dataset: any) {
      e.props.dataset = dataset;
    }

    __SetGestureDetector(
      e: LynxFiberElement,
      id: number,
      type: number,
      config: any,
      relationMap: Record<string, number[]>,
    ) {
      e.props.gesture = {
        id,
        type,
        config,
        relationMap,
      };
    }

    __GetDataset(e: LynxFiberElement) {
      return e.props.dataset;
    }

    __RemoveElement(parent: LynxFiberElement, child: LynxFiberElement) {
      parent.children.forEach((ch, index) => {
        if (ch === child) {
          parent.children.splice(index, 1);
          return;
        }
      });
      parentMap.delete(child);
    }

    __InsertElementBefore(
      parent: LynxFiberElement,
      child: LynxFiberElement,
      ref?: LynxFiberElement | number,
    ) {
      if (typeof ref === 'undefined') {
        child.parent = parent;
        parent.children.push(child);
      } else {
        const index = parent.children.indexOf(ref);
        parent.children.splice(index, 0, child);
      }
      parentMap.set(child, parent);
    }

    __ReplaceElement(
      newElement: LynxFiberElement,
      oldElement: LynxFiberElement,
    ) {
      const parent = parentMap.get(oldElement);
      if (!parent) {
        /* c8 ignore next */
        throw new Error('unreachable');
      }
      parent.children.forEach((ch, index) => {
        if (ch === oldElement) {
          parent.children[index] = newElement;
          return;
        }
      });
    }

    __FlushElementTree(): void {}

    __UpdateListComponents(list: LynxFiberElement, components: string[]) {}

    __UpdateListActions(
      list: LynxFiberElement,
      removals: number[],
      insertions: number[],
      moveFrom: number[],
      moveTo: number[],
      updateFrom: number[],
      updateTo: number[],
    ) {}

    __UpdateListCallbacks(
      list: LynxFiberElement,
      componentAtIndex: (
        list: LynxFiberElement,
        listID: number,
        cellIndex: number,
        operationID: number,
        enable_reuse_notification: boolean,
      ) => void,
      enqueueComponent: (
        list: LynxFiberElement,
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

    __GetTag(ele: LynxFiberElement) {
      return ele.type;
    }

    __GetAttributeByName(ele: LynxFiberElement, name: string) {
      return ele.props[name];
    }

    clear() {
      this.root = undefined;
    }

    toTree() {
      return this.root;
    }

    getElementById(id: string): LynxFiberElement | undefined {
      const find = (e: LynxFiberElement): LynxFiberElement | undefined => {
        if (typeof e === 'string') {
          return;
        }
        if (e.props.id === id) {
          return e;
        }
        for (const child of e.children) {
          const result = find(child);
          if (result) {
            return result;
          }
        }
        return undefined;
      };
      return find(this.root!);
    }

    triggerComponentAtIndex(
      e: LynxFiberElement,
      index: number,
      ...args: any[]
    ): number {
      // @ts-ignore
      const { componentAtIndex, $$uiSign } = e;
      return componentAtIndex(e, $$uiSign, index, ...args);
    }

    triggerEnqueueComponent(e: LynxFiberElement, uiSign: number) {
      // @ts-ignore
      const { enqueueComponent, $$uiSign } = e;
      enqueueComponent(e, $$uiSign, uiSign);
    }

    toJSON() {
      return prettyFormat(this.toTree(), {
        plugins: [ReactTestComponent],
        printFunctionName: false,
      });
    }

    __SendEvent(
      e: LynxFiberElement,
      eventType: string,
      eventName: string,
      data: any,
    ) {
      if (process.env.DEBUG) {
        console.log('__SendEvent', e, eventType, eventName, data);
      }
      const eventHandler = e.props?.event?.[`${eventType}:${eventName}`];
      debugger;
      if (eventHandler) {
        // main thread events
        if (
          typeof eventHandler === 'object' && eventHandler.type === 'worklet'
        ) {
          const isBackground = !__LEPUS__;
          globalThis.lynxDOM.switchToMainThread();

          // @ts-ignore
          runWorklet(eventHandler.value, [data]);

          if (isBackground) {
            globalThis.lynxDOM.switchToBackgroundThread();
          }
        } else {
          // @ts-ignore
          globalThis.lynxCoreInject.tt.publishEvent(eventHandler, data);
        }
      }
    }
    __GetElementByUniqueId(uniqueId: number) {
      return uniqueId2Element.get(uniqueId);
    }
  })();
};

export const initNativeMethodQueue = (): [string, any[]][] => {
  let nativeMethodQueue: [string, any[]][] = [];
  Object.defineProperty(nativeMethodQueue, 'clear', {
    value: () => {
      nativeMethodQueue.length = 0;
    },
  });
  return nativeMethodQueue;
};
