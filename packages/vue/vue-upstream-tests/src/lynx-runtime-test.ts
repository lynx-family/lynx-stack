/**
 * Adapter that replaces @vue/runtime-test with one backed by our real
 * ShadowElement linked-list implementation.
 *
 * The upstream runtime-core tests use TestElement / TestText / TestComment
 * with children[], props, eventListeners, and serializeInner(). We augment
 * each ShadowElement instance with these properties so that upstream test
 * assertions (el.children[0], el.props.foo, el.text) work unchanged, while
 * tree operations (insert, remove, parentNode, nextSibling) exercise our
 * real linked-list code.
 */

import {
  type CreateAppFunction,
  type RootRenderFunction,
  type VNode,
  createRenderer,
} from '@vue/runtime-core';
import { markRaw } from '@vue/reactivity';
import { isArray } from '@vue/shared';

import { ShadowElement } from '../../runtime/src/shadow-element.js';

// ---------------------------------------------------------------------------
// Test node types (mirrors @vue/runtime-test)
// ---------------------------------------------------------------------------

export enum TestNodeTypes {
  TEXT = 'text',
  ELEMENT = 'element',
  COMMENT = 'comment',
}

export enum NodeOpTypes {
  CREATE = 'create',
  INSERT = 'insert',
  REMOVE = 'remove',
  SET_TEXT = 'setText',
  SET_ELEMENT_TEXT = 'setElementText',
  PATCH = 'patch',
}

/**
 * A ShadowElement augmented with the properties upstream tests expect.
 * We define children as a getter that walks the linked list, so both
 * the linked-list structure AND the array access patterns work.
 */
export interface TestElement {
  id: number;
  type: TestNodeTypes;
  parentNode: TestElement | null;
  tag: string;
  children: TestNode[];
  props: Record<string, any>;
  eventListeners: Record<string, Function | Function[]> | null;
  text: string;
  // ShadowElement tree fields (used internally)
  _se: ShadowElement;
}

export interface TestText {
  id: number;
  type: TestNodeTypes.TEXT;
  parentNode: TestElement | null;
  text: string;
  _se: ShadowElement;
}

export interface TestComment {
  id: number;
  type: TestNodeTypes.COMMENT;
  parentNode: TestElement | null;
  text: string;
  _se: ShadowElement;
}

export type TestNode = TestElement | TestText | TestComment;

export interface NodeOp {
  type: NodeOpTypes;
  nodeType?: TestNodeTypes;
  tag?: string;
  text?: string;
  targetNode?: TestNode;
  parentNode?: TestElement;
  refNode?: TestNode | null;
  propKey?: string;
  propPrevValue?: any;
  propNextValue?: any;
}

// ---------------------------------------------------------------------------
// Mapping between ShadowElement and TestNode
// ---------------------------------------------------------------------------

const seToTest = new WeakMap<ShadowElement, TestNode>();

function getTestNode(se: ShadowElement): TestNode {
  return seToTest.get(se)!;
}

/** Collect children by walking the ShadowElement linked list. */
function getChildrenFromSE(se: ShadowElement): TestNode[] {
  const children: TestNode[] = [];
  let child = se.firstChild;
  while (child) {
    const testNode = seToTest.get(child);
    if (testNode) children.push(testNode);
    child = child.next;
  }
  return children;
}

// ---------------------------------------------------------------------------
// Op logging
// ---------------------------------------------------------------------------

let recordedNodeOps: NodeOp[] = [];

export function logNodeOp(op: NodeOp): void {
  recordedNodeOps.push(op);
}

export function resetOps(): void {
  recordedNodeOps = [];
}

export function dumpOps(): NodeOp[] {
  const ops = recordedNodeOps.slice();
  resetOps();
  return ops;
}

// ---------------------------------------------------------------------------
// Node factory helpers
// ---------------------------------------------------------------------------

function makeTestElement(tag: string): TestElement {
  const se = new ShadowElement(tag);
  const node: TestElement = {
    id: se.id,
    type: TestNodeTypes.ELEMENT,
    tag,
    props: {},
    eventListeners: null,
    text: '',
    _se: se,
    get parentNode(): TestElement | null {
      return se.parent ? (getTestNode(se.parent) as TestElement) : null;
    },
    set parentNode(_v: TestElement | null) {
      // no-op; managed by ShadowElement
    },
    get children(): TestNode[] {
      return getChildrenFromSE(se);
    },
    set children(_v: TestNode[]) {
      // no-op; managed by ShadowElement
    },
  };
  seToTest.set(se, node);
  markRaw(node);
  return node;
}

function makeTestText(text: string): TestText {
  const se = new ShadowElement('#text');
  const node: TestText = {
    id: se.id,
    type: TestNodeTypes.TEXT,
    text,
    _se: se,
    get parentNode(): TestElement | null {
      return se.parent ? (getTestNode(se.parent) as TestElement) : null;
    },
    set parentNode(_v: TestElement | null) {
      // no-op
    },
  };
  seToTest.set(se, node);
  markRaw(node);
  return node;
}

function makeTestComment(text: string): TestComment {
  const se = new ShadowElement('#comment');
  const node: TestComment = {
    id: se.id,
    type: TestNodeTypes.COMMENT,
    text,
    _se: se,
    get parentNode(): TestElement | null {
      return se.parent ? (getTestNode(se.parent) as TestElement) : null;
    },
    set parentNode(_v: TestElement | null) {
      // no-op
    },
  };
  seToTest.set(se, node);
  markRaw(node);
  return node;
}

// ---------------------------------------------------------------------------
// nodeOps implementation using ShadowElement
// ---------------------------------------------------------------------------

function createElement(tag: string): TestElement {
  const node = makeTestElement(tag);
  logNodeOp({
    type: NodeOpTypes.CREATE,
    nodeType: TestNodeTypes.ELEMENT,
    targetNode: node,
    tag,
  });
  return node;
}

function createText(text: string): TestText {
  const node = makeTestText(text);
  logNodeOp({
    type: NodeOpTypes.CREATE,
    nodeType: TestNodeTypes.TEXT,
    targetNode: node,
    text,
  });
  return node;
}

function createComment(text: string): TestComment {
  const node = makeTestComment(text);
  logNodeOp({
    type: NodeOpTypes.CREATE,
    nodeType: TestNodeTypes.COMMENT,
    targetNode: node,
    text,
  });
  return node;
}

function setText(node: TestText, text: string): void {
  logNodeOp({
    type: NodeOpTypes.SET_TEXT,
    targetNode: node,
    text,
  });
  node.text = text;
}

function insert(
  child: TestNode,
  parent: TestElement,
  ref?: TestNode | null,
): void {
  logNodeOp({
    type: NodeOpTypes.INSERT,
    targetNode: child,
    parentNode: parent,
    refNode: ref,
  });
  // Use ShadowElement's insertBefore which handles detach internally
  parent._se.insertBefore(child._se, ref ? ref._se : null);
}

function remove(child: TestNode): void {
  const parentSE = child._se.parent;
  if (parentSE) {
    const parent = getTestNode(parentSE) as TestElement;
    logNodeOp({
      type: NodeOpTypes.REMOVE,
      targetNode: child,
      parentNode: parent,
    });
    parentSE.removeChild(child._se);
  }
}

function setElementText(el: TestElement, text: string): void {
  logNodeOp({
    type: NodeOpTypes.SET_ELEMENT_TEXT,
    targetNode: el,
    text,
  });
  // Remove all children from the ShadowElement linked list
  while (el._se.firstChild) {
    el._se.removeChild(el._se.firstChild);
  }
  if (text) {
    const textNode = makeTestText(text);
    el._se.insertBefore(textNode._se, null);
  }
}

function parentNode(node: TestNode): TestElement | null {
  const parentSE = node._se.parent;
  return parentSE ? (getTestNode(parentSE) as TestElement) : null;
}

function nextSibling(node: TestNode): TestNode | null {
  const nextSE = node._se.next;
  return nextSE ? getTestNode(nextSE) : null;
}

function querySelector(): never {
  throw new Error('querySelector not supported in test renderer.');
}

function setScopeId(el: TestElement, id: string): void {
  el.props[id] = '';
}

export const nodeOps = {
  insert,
  remove,
  createElement,
  createText,
  createComment,
  setText,
  setElementText,
  parentNode,
  nextSibling,
  querySelector,
  setScopeId,
};

// ---------------------------------------------------------------------------
// patchProp
// ---------------------------------------------------------------------------

function isOn(key: string): boolean {
  return (
    key.charCodeAt(0) === 111 /* o */
    && key.charCodeAt(1) === 110 /* n */
    && key.charCodeAt(2) > 64 && key.charCodeAt(2) < 91 /* A-Z */
  );
}

export function patchProp(
  el: TestElement,
  key: string,
  prevValue: any,
  nextValue: any,
): void {
  logNodeOp({
    type: NodeOpTypes.PATCH,
    targetNode: el,
    propKey: key,
    propPrevValue: prevValue,
    propNextValue: nextValue,
  });
  el.props[key] = nextValue;
  if (isOn(key)) {
    const event = key[2] === ':' ? key.slice(3) : key.slice(2).toLowerCase();
    if (!el.eventListeners) el.eventListeners = {};
    el.eventListeners[event] = nextValue;
  }
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

export function serialize(
  node: TestNode,
  indent: number = 0,
  depth: number = 0,
): string {
  if (node.type === TestNodeTypes.ELEMENT) {
    return serializeElement(node as TestElement, indent, depth);
  } else {
    return serializeText(node as TestText | TestComment, indent, depth);
  }
}

export function serializeInner(
  node: TestElement,
  indent: number = 0,
  depth: number = 0,
): string {
  const children = node.children;
  const newLine = indent ? '\n' : '';
  return children.length
    ? newLine
      + children.map((c) => serialize(c, indent, depth + 1)).join(newLine)
      + newLine
    : '';
}

function serializeElement(
  node: TestElement,
  indent: number,
  depth: number,
): string {
  const props = Object.keys(node.props)
    .map((key) => {
      const value = node.props[key];
      return isOn(key) || value == null
        ? ''
        : value === ''
        ? key
        : `${key}=${JSON.stringify(value)}`;
    })
    .filter(Boolean)
    .join(' ');
  const padding = indent ? ' '.repeat(indent).repeat(depth) : '';
  return (
    `${padding}<${node.tag}${props ? ` ${props}` : ''}>`
    + `${serializeInner(node, indent, depth)}`
    + `${padding}</${node.tag}>`
  );
}

function serializeText(
  node: TestText | TestComment,
  indent: number,
  depth: number,
): string {
  const padding = indent ? ' '.repeat(indent).repeat(depth) : '';
  return (
    padding
    + (node.type === TestNodeTypes.COMMENT ? `<!--${node.text}-->` : node.text)
  );
}

// ---------------------------------------------------------------------------
// triggerEvent
// ---------------------------------------------------------------------------

export function triggerEvent(
  el: TestElement,
  event: string,
  payload: any[] = [],
): void {
  const { eventListeners } = el;
  if (eventListeners) {
    const listener = eventListeners[event];
    if (listener) {
      if (isArray(listener)) {
        for (let i = 0; i < listener.length; i++) {
          (listener[i] as Function)(...payload);
        }
      } else {
        (listener as Function)(...payload);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

const { render: baseRender, createApp: baseCreateApp } = createRenderer({
  patchProp,
  ...nodeOps,
});

export const render = baseRender as RootRenderFunction<TestElement>;
export const createApp = baseCreateApp as CreateAppFunction<TestElement>;

export function renderToString(vnode: VNode): string {
  const root = nodeOps.createElement('div');
  render(vnode, root);
  return serializeInner(root);
}

// ---------------------------------------------------------------------------
// Re-export everything from @vue/runtime-core
// ---------------------------------------------------------------------------

export * from '@vue/runtime-core';
