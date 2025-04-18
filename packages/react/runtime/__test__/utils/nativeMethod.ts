/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { format as prettyFormat, plugins } from 'pretty-format';
// import { globalEnvManager } from "./inject";
const { ReactTestComponent } = plugins;

interface Element {
  type: string;
  props: any;
  children: any[];
}

interface ElementOptions {
  onCreateElement?: ((element: Element) => void) | undefined;
}

export let uiSignNext = 0;
export const parentMap = new WeakMap<Element, Element>();
// export const elementPrototype = Object.create(null);
export const options: ElementOptions = {};

export const elementTree = new (class {
  root?: Element = undefined;

  __CreatePage(tag: string, parentComponentUniqueId: number) {
    return (this.root ??= this.__CreateElement('page', parentComponentUniqueId));
  }

  __CreateRawText(text: string) {
    const r = this.__CreateElement('raw-text', 0);
    // @ts-ignore
    r.props.text = text;
    this.root ??= r;
    return r;
  }

  __GetElementUniqueID(e: Element): number {
    // @ts-ignore
    return e.$$uiSign;
  }

  __SetClasses(e: Element, cls: string) {
    e.props.class = cls;
  }

  __CreateElement(tag: string, parentComponentUniqueId: number) {
    const json = {
      type: tag,
      children: [],
      props: {},
      parentComponentUniqueId,
    };
    Object.defineProperty(json, '$$typeof', {
      value: Symbol.for('react.test.json'),
    });
    Object.defineProperty(json, '$$uiSign', {
      value: uiSignNext++,
    });

    options.onCreateElement?.(json);

    this.root ??= json;
    return json;
  }

  __CreateView(parentComponentUniqueId: number) {
    return this.__CreateElement('view', parentComponentUniqueId);
  }
  __FirstElement(e: Element) {
    return e.children[0];
  }

  __CreateText(parentComponentUniqueId: number) {
    const r = this.__CreateElement('text', parentComponentUniqueId);
    this.root ??= r;
    return r;
  }

  __CreateImage(parentComponentUniqueId: number) {
    const r = this.__CreateElement('image', parentComponentUniqueId);
    this.root ??= r;
    return r;
  }

  __CreateWrapperElement(parentComponentUniqueId: number) {
    return this.__CreateElement('wrapper', parentComponentUniqueId);
  }

  __AddInlineStyle(e: Element, key: number, value: string) {
    const style = e.props.style || {};
    style[key] = value;
    e.props.style = style;
  }

  __AppendElement(parent: Element, child: Element) {
    parent.children.push(child);
    parentMap.set(child, parent);
  }

  __SetCSSId(e: Element | Element[], id: string, entryName?: string) {
    const cssId = `${entryName ?? 'default-entry-from-native'}:${id}`;
    if (Array.isArray(e)) {
      e.forEach(item => {
        item.props.cssId = cssId;
      });
    } else {
      e.props.cssId = cssId;
    }
  }

  __SetAttribute(e: Element, key: string, value: any) {
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

  __GetAttributes(e: Element): Record<string, any> {
    return e.props;
  }

  __AddEvent(e: Element, eventType: string, eventName: string, event: string | Record<string, any>) {
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

  __GetEvent(e: Element, eventType: string, eventName: string) {
    const jsFunction = e.props.event?.[`${eventType}:${eventName}`];
    if (typeof jsFunction !== 'undefined') {
      return {
        type: eventType,
        name: eventName,
        jsFunction,
      };
    }
  }

  __SetID(e: Element, id: string) {
    e.props.id = id;
  }

  __SetInlineStyles(e: Element, styles: string | Record<string, string>) {
    e.props.style = styles;
  }

  __AddDataset(e: Element, key: string, value: string) {
    (e.props.dataset ??= {})[key] = value;
  }

  __SetDataset(e: Element, dataset: any) {
    e.props.dataset = dataset;
  }

  __SetGestureDetector(e: Element, id: number, type: number, config: any, relationMap: Record<string, number[]>) {
    e.props.gesture = {
      id,
      type,
      config,
      relationMap,
    };
  }

  __GetDataset(e: Element) {
    return e.props.dataset;
  }

  __RemoveElement(parent: Element, child: Element) {
    parent.children.forEach((ch, index) => {
      if (ch === child) {
        parent.children.splice(index, 1);
        return;
      }
    });
    parentMap.delete(child);
  }

  __InsertElementBefore(
    parent: Element,
    child: Element,
    ref?: Element | number,
  ) {
    if (typeof ref === 'undefined') {
      parent.children.push(child);
    } else {
      const index = parent.children.indexOf(ref);
      parent.children.splice(index, 0, child);
    }
    parentMap.set(child, parent);
  }

  __ReplaceElement(newElement: Element, oldElement: Element) {
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

  __UpdateListComponents(list: Element, components: string[]) {}

  __UpdateListActions(
    list: Element,
    removals: number[],
    insertions: number[],
    moveFrom: number[],
    moveTo: number[],
    updateFrom: number[],
    updateTo: number[],
  ) {}

  __UpdateListCallbacks(
    list: Element,
    componentAtIndex: (
      list: Element,
      listID: number,
      cellIndex: number,
      operationID: number,
      enable_reuse_notification: boolean,
    ) => void,
    enqueueComponent: (list: Element, listID: number, sign: number) => void,
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

  __GetTag(ele: Element) {
    return ele.type;
  }

  __GetAttributeByName(ele: Element, name: string) {
    return ele.props[name];
  }

  clear() {
    this.root = undefined;
  }

  toTree() {
    return this.root;
  }

  sendEvent(e: Element, eventType: string, eventName: string, data: any) {
    const eventHandler = e.props?.event?.[`${eventType}:${eventName}`];
    if (eventHandler) {
      // @ts-ignore
      globalThis.lynxCoreInject.tt.publishEvent(eventHandler, data);
    }
  }

  getElementById(id: string): Element | undefined {
    const find = (e: Element): Element | undefined => {
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

  triggerComponentAtIndex(e: Element, index: number, ...args: any[]): number {
    // @ts-ignore
    const { componentAtIndex, $$uiSign } = e;
    return componentAtIndex(e, $$uiSign, index, ...args);
  }

  triggerEnqueueComponent(e: Element, uiSign: number) {
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
})();

export const nativeMethodQueue: [string, any[]][] = [];

Object.defineProperty(nativeMethodQueue, 'clear', {
  value: () => {
    nativeMethodQueue.length = 0;
  },
});

export function withQueue<T>(
  name: string,
  fn: (this: T, ...args: any[]) => any,
) {
  return function(this: T, ...args: any[]) {
    nativeMethodQueue.push([name, args]);
    return fn.apply(this, args);
  };
}

// export function withLog<T>(name: string, fn: (this: T, ...args: any[]) => any) {
//   return function (this: T, ...args: any[]) {
//     // console.log(name, ...args);
//     try {
//       // console2.profile(name);
//       return fn.apply(this, args);
//     } finally {
//       // console2.profileEnd(name);
//     }
//   };
// }

export function waitSchedule(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      setTimeout(resolve);
    });
  });
}
