// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * A minimal remote-DOM implementation for vanilla preact running in the
 * background thread. Every mutation is recorded as an op and flushed to the
 * fixed main-thread runtime, which applies it through the Element PAPI.
 *
 * Elements are wrapped in a `Proxy` whose `has` trap always returns `true`,
 * so preact's `name in dom` check routes every non-special prop through the
 * `set` trap, where Lynx event props (`bindtap`, `catchtap`, ...) and
 * attributes are translated into ops.
 */

import { beforeFlush, enqueueOp } from './channel.js';
import { BackgroundMainThreadElement } from './mainThreadElement.js';
import * as Ops from './ops.js';

/** Matches ReactLynx event prop names, e.g. `bindtap`, `main-thread:bindtap`. */
const eventRegExp =
  /^(?:([A-Za-z-]*):)?(bind|catch|capture-bind|capture-catch|global-bind)([A-Za-z]+)$/;

const eventTypeMap: Record<string, string> = {
  bind: 'bindEvent',
  catch: 'catchEvent',
  'capture-bind': 'capture-bind',
  'capture-catch': 'capture-catch',
  'global-bind': 'global-bindEvent',
};

let nextId = Ops.PAGE_ID + 1;

export const nodesById: Map<number, RemoteNode> = new Map();

export class RemoteNode {
  _id: number;
  _parent: RemoteElement | null = null;

  constructor(id: number = nextId++) {
    this._id = id;
    nodesById.set(this._id, this);
  }

  get parentNode(): RemoteElement | null {
    return this._parent;
  }

  get nextSibling(): RemoteNode | null {
    const parent = this._parent;
    if (!parent) {
      return null;
    }
    const index = parent._children.indexOf(this._self());
    return parent._children[index + 1] ?? null;
  }

  remove(): void {
    this._parent?.removeChild(this._self());
  }

  /**
   * The identity preact sees: the proxy for elements, the instance for text.
   */
  _self(): RemoteNode {
    return this;
  }
}

export class RemoteText extends RemoteNode {
  _data: string;

  constructor(data: string) {
    super();
    this._data = data;
    enqueueOp([Ops.CreateText, this._id, data]);
  }

  get data(): string {
    return this._data;
  }

  set data(value: string) {
    const text = String(value);
    if (text !== this._data) {
      this._data = text;
      enqueueOp([Ops.SetText, this._id, text]);
    }
  }

  get nodeValue(): string {
    return this._data;
  }

  set nodeValue(value: string) {
    this.data = value;
  }
}

/** The style object surface preact interacts with. */
export interface RemoteStyle {
  cssText: string;
  setProperty(name: string, value: string | null): void;
  removeProperty(name: string): void;
  [key: string]: unknown;
}

interface StyleState {
  cssText: string;
  props: Map<string, string>;
  dirty: boolean;
}

function serializeStyle(state: StyleState): string {
  let out = state.cssText;
  for (const [key, value] of state.props) {
    if (value === '') {
      continue;
    }
    const name = key.startsWith('--')
      ? key
      : key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
    out += `${out && !out.endsWith(';') ? ';' : ''}${name}:${value};`;
  }
  return out;
}

function createStyleProxy(element: RemoteElement): RemoteStyle {
  const state: StyleState = { cssText: '', props: new Map(), dirty: false };
  const markDirty = () => {
    if (!state.dirty) {
      state.dirty = true;
      beforeFlush(() => {
        state.dirty = false;
        enqueueOp([Ops.SetStyle, element._id, serializeStyle(state)]);
      });
    }
  };
  const target = {
    setProperty(name: string, value: string | null): void {
      state.props.set(name, value == null ? '' : String(value));
      markDirty();
    },
    removeProperty(name: string): void {
      state.props.delete(name);
      markDirty();
    },
  };
  return new Proxy(target, {
    get(t, prop) {
      if (prop === 'cssText') {
        return state.cssText;
      }
      if (prop in t) {
        return Reflect.get(t, prop) as unknown;
      }
      return state.props.get(prop as string) ?? '';
    },
    set(t, prop, value) {
      if (typeof prop === 'symbol') {
        return Reflect.set(t, prop, value);
      }
      if (prop === 'cssText') {
        state.cssText = value == null ? '' : String(value);
        state.props.clear();
      } else {
        state.props.set(prop, value == null ? '' : String(value));
      }
      markDirty();
      return true;
    },
  }) as unknown as RemoteStyle;
}

export type EventListenerFn = (event: unknown) => void;

export class RemoteElement extends RemoteNode {
  _tag: string;
  _children: RemoteNode[] = [];
  _listeners: Map<string, EventListenerFn> = new Map();
  _mtListeners: Map<string, EventListenerFn> = new Map();
  _workletEvents: Map<string, number> = new Map();
  _attributes: Map<string, unknown> = new Map();
  _dataset: Record<string, unknown> = {};
  _datasetDirty = false;
  _style: RemoteStyle | undefined;
  _proxy: RemoteElement;

  constructor(tag: string, id?: number) {
    super(id);
    this._tag = tag;
    if (this._id !== Ops.PAGE_ID) {
      enqueueOp([Ops.CreateElement, this._id, tag]);
    }
    this._proxy = wrapElement(this);
    return this;
  }

  override _self(): RemoteNode {
    return this._proxy;
  }

  get style(): RemoteStyle {
    return (this._style ??= createStyleProxy(this));
  }

  get childNodes(): RemoteNode[] {
    return this._children;
  }

  get firstChild(): RemoteNode | null {
    return this._children[0] ?? null;
  }

  get className(): string {
    return '';
  }

  set className(value: string) {
    enqueueOp([Ops.SetClasses, this._id, value == null ? '' : String(value)]);
  }

  insertBefore(child: RemoteNode, ref?: RemoteNode | null): RemoteNode {
    const childNode = child._self();
    if (childNode._parent) {
      childNode._parent._detach(childNode);
    }
    const refNode = ref?._self() ?? null;
    const index = refNode ? this._children.indexOf(refNode) : -1;
    if (index >= 0) {
      this._children.splice(index, 0, childNode);
    } else {
      this._children.push(childNode);
    }
    childNode._parent = this._proxy ?? this;
    enqueueOp([
      Ops.InsertBefore,
      this._id,
      childNode._id,
      index >= 0 && refNode ? refNode._id : 0,
    ]);
    return child;
  }

  appendChild(child: RemoteNode): RemoteNode {
    return this.insertBefore(child, null);
  }

  removeChild(child: RemoteNode): RemoteNode {
    this._detach(child._self());
    enqueueOp([Ops.Remove, this._id, child._self()._id]);
    return child;
  }

  _detach(child: RemoteNode): void {
    const index = this._children.indexOf(child);
    if (index >= 0) {
      this._children.splice(index, 1);
      child._parent = null;
    } else if (child._parent && child._parent !== this._proxy) {
      // A move initiated while the child belongs elsewhere.
      child._parent._detach(child);
    }
  }

  contains(node: RemoteNode | null): boolean {
    while (node) {
      if (node === this._proxy || (node as RemoteNode) === this) {
        return true;
      }
      node = node._parent;
    }
    return false;
  }

  setAttribute(name: string, value: unknown): void {
    routeProp(this, name, value);
  }

  removeAttribute(name: string): void {
    routeProp(this, name, null);
  }

  addEventListener(type: string, listener: EventListenerFn): void {
    // preact routes `onXxx` props here; treat them as `bindEvent`.
    this._setListener('bindEvent', type, listener);
  }

  removeEventListener(type: string): void {
    this._setListener('bindEvent', type, null);
  }

  _setListener(
    eventType: string,
    eventName: string,
    listener: EventListenerFn | null,
  ): void {
    const key = `${eventType}:${eventName}`;
    const had = this._listeners.has(key);
    if (listener) {
      this._listeners.set(key, listener);
      if (!had) {
        enqueueOp([Ops.SetEvent, this._id, eventType, eventName, 1]);
      }
    } else if (had) {
      this._listeners.delete(key);
      enqueueOp([Ops.SetEvent, this._id, eventType, eventName, 0]);
    }
  }

  _setMainThreadListener(
    eventType: string,
    eventName: string,
    listener: EventListenerFn | null,
  ): void {
    const key = `${eventType}:${eventName}`;
    const had = this._mtListeners.has(key);
    if (listener) {
      this._mtListeners.set(key, listener);
      if (!had) {
        enqueueOp([Ops.SetEvent, this._id, eventType, eventName, 1]);
      }
    } else if (had) {
      this._mtListeners.delete(key);
      if (!this._listeners.has(key)) {
        enqueueOp([Ops.SetEvent, this._id, eventType, eventName, 0]);
      }
    }
  }

  _setWorkletListener(
    eventType: string,
    eventName: string,
    hash: number,
  ): void {
    const key = `worklet:${eventType}:${eventName}`;
    const prev = this._workletEvents.get(key) ?? 0;
    if (prev === hash) {
      return;
    }
    if (hash) {
      this._workletEvents.set(key, hash);
    } else {
      this._workletEvents.delete(key);
    }
    enqueueOp([Ops.SetWorkletEvent, this._id, eventType, eventName, hash]);
  }

  _setDataset(key: string, value: unknown): void {
    if (value == null) {
      delete this._dataset[key];
    } else {
      this._dataset[key] = value;
    }
    if (!this._datasetDirty) {
      this._datasetDirty = true;
      beforeFlush(() => {
        this._datasetDirty = false;
        enqueueOp([Ops.SetDataset, this._id, this._dataset]);
      });
    }
  }

  get dataset(): Record<string, unknown> {
    return this._dataset;
  }
}

function routeProp(element: RemoteElement, name: string, value: unknown): void {
  // Note: event removal arrives as `''` because preact assigns
  // `dom[name] = value == null ? '' : value` on the property path.
  const match = eventRegExp.exec(name);
  if (match) {
    const [, prefix, type, eventName] = match;
    if (prefix === 'main-thread') {
      // Without a compiler there is no closure extraction, so main-thread
      // handlers run on the background thread against an op-backed Element.
      element._setMainThreadListener(
        eventTypeMap[type!]!,
        eventName!,
        typeof value === 'function' ? (value as EventListenerFn) : null,
      );
      return;
    }
    const eventType = prefix === 'global'
      ? 'global-bindEvent'
      : eventTypeMap[type!]!;
    element._setListener(
      eventType,
      eventName!,
      typeof value === 'function' ? (value as EventListenerFn) : null,
    );
    return;
  }
  if (name === 'main-thread:ref') {
    assignMainThreadRef(element, value);
    return;
  }
  switch (name) {
    case 'class':
    case 'className':
      element.className = value as string;
      return;
    case 'id':
      enqueueOp([
        Ops.SetId,
        element._id,
        value == null ? null : String(value as string | number),
      ]);
      return;
    case 'style':
      // Reached through setAttribute only (string form).
      enqueueOp([Ops.SetStyle, element._id, value ?? '']);
      return;
    case 'dangerouslySetInnerHTML':
      throw new Error('dangerouslySetInnerHTML is not supported in Lynx');
    default:
      break;
  }
  if (name.startsWith('data-')) {
    element._setDataset(name.slice(5), value);
    return;
  }
  if (typeof value === 'function') {
    // Non-event function-valued props cannot cross the thread boundary.
    return;
  }
  element._attributes.set(name, value === undefined ? null : value);
  enqueueOp([
    Ops.SetAttribute,
    element._id,
    name,
    value === undefined ? null : value,
  ]);
}

function assignMainThreadRef(element: RemoteElement, value: unknown): void {
  const wrapped = new BackgroundMainThreadElement(element);
  if (typeof value === 'function') {
    (value as (el: unknown) => void)(wrapped);
  } else if (value && typeof value === 'object') {
    (value as { current: unknown }).current = wrapped;
  }
}

/** Fields managed by {@link RemoteElement} itself; everything else that is
 * assigned by preact is routed as a prop. */
function isInternalProp(prop: string): boolean {
  return prop.startsWith('_');
}

function wrapElement(element: RemoteElement): RemoteElement {
  return new Proxy(element, {
    // Make `name in dom` true so preact assigns props as properties,
    // letting the `set` trap route them (including function values, which
    // preact would silently drop on the setAttribute path).
    has() {
      return true;
    },
    set(target, prop, value, receiver) {
      if (typeof prop === 'symbol' || isInternalProp(prop)) {
        return Reflect.set(target, prop, value, receiver);
      }
      const descriptor = findDescriptor(target, prop);
      if (descriptor?.set) {
        return Reflect.set(target, prop, value, receiver);
      }
      routeProp(target, prop, value);
      return true;
    },
  });
}

function findDescriptor(
  target: object,
  prop: string,
): PropertyDescriptor | undefined {
  let proto: object | null = target;
  while (proto) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
    if (descriptor) {
      return descriptor;
    }
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  return undefined;
}

export class RemoteDocument {
  createElement(tag: string): RemoteNode {
    return new RemoteElement(tag)._self();
  }

  createElementNS(_ns: string, tag: string): RemoteNode {
    return this.createElement(tag);
  }

  createTextNode(data: string): RemoteText {
    return new RemoteText(String(data));
  }
}

/** The root container mapped to the page element on the main thread. */
export function createPageContainer(): RemoteElement {
  const page = new RemoteElement('page', Ops.PAGE_ID);
  return page._self() as RemoteElement;
}
