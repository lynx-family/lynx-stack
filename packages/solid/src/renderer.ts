// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRenderer } from 'solid-js/universal';
import type { Renderer } from 'solid-js/universal';

import type {
  ElementTemplateHandle,
  ElementTemplateSerializableValue,
  RemoteElementTemplateRuntime,
} from '@lynx-js/element-template-runtime';
import {
  BUILTIN_RAW_TEXT_TEMPLATE_KEY,
  ELEMENT_TEMPLATE_SPREAD_ATTRIBUTE_SLOT_INDEX,
  isLynxEventAttributeName,
} from '@lynx-js/element-template-runtime';

export interface SolidLynxRendererContext {
  eventHandlers: Map<string, (event: unknown) => unknown>;
  remote: RemoteElementTemplateRuntime;
}

export interface SolidLynxNode {
  readonly attributeSlots:
    | Readonly<Record<string, number>>
    | undefined;
  readonly context: SolidLynxRendererContext;
  readonly endChildSlotIndex: number | undefined;
  readonly handle: ElementTemplateHandle<number>;
  readonly kind: 'element' | 'root' | 'slot' | 'template' | 'text';
  readonly ownsHandle: boolean;
  readonly properties: Record<string, ElementTemplateSerializableValue>;
  readonly spreadAttributeSlotIndex: number | undefined;
  attachedChildSlotIndex: number | undefined;
  children: SolidLynxNode[];
  parent: SolidLynxNode | undefined;
}

let activeContext: SolidLynxRendererContext | undefined;

function getActiveContext(): SolidLynxRendererContext {
  if (activeContext === undefined) {
    throw new Error(
      'SolidLynx renderer is not attached to an active root.',
    );
  }
  return activeContext;
}

function createNode(
  node: SolidLynxNode,
): SolidLynxNode {
  return node;
}

export function createSolidLynxRootNode(
  context: SolidLynxRendererContext,
): SolidLynxNode {
  return createNode({
    attributeSlots: undefined,
    context,
    endChildSlotIndex: 0,
    handle: context.remote.root,
    kind: 'root',
    ownsHandle: false,
    properties: {},
    spreadAttributeSlotIndex: undefined,
    attachedChildSlotIndex: undefined,
    children: [],
    parent: undefined,
  });
}

function createElementNode(tag: string): SolidLynxNode {
  const context = getActiveContext();
  const properties: Record<string, ElementTemplateSerializableValue> = {};
  return createNode({
    attributeSlots: undefined,
    context,
    endChildSlotIndex: 0,
    handle: context.remote.runtime.createTemplate({
      templateKey: tag,
      attributeSlots: [properties],
    }),
    kind: 'element',
    ownsHandle: true,
    properties,
    spreadAttributeSlotIndex: ELEMENT_TEMPLATE_SPREAD_ATTRIBUTE_SLOT_INDEX,
    attachedChildSlotIndex: undefined,
    children: [],
    parent: undefined,
  });
}

function createTextNodeImpl(value: string): SolidLynxNode {
  const context = getActiveContext();
  return createNode({
    attributeSlots: { text: 0 },
    context,
    endChildSlotIndex: undefined,
    handle: context.remote.runtime.createTemplate({
      templateKey: BUILTIN_RAW_TEXT_TEMPLATE_KEY,
      attributeSlots: [value],
    }),
    kind: 'text',
    ownsHandle: true,
    properties: {},
    spreadAttributeSlotIndex: undefined,
    attachedChildSlotIndex: undefined,
    children: [],
    parent: undefined,
  });
}

function replaceText(node: SolidLynxNode, value: string): void {
  const attributeSlotIndex = node.attributeSlots?.['text'];
  if (attributeSlotIndex === undefined) {
    throw new Error('A static SolidLynx text node cannot be replaced.');
  }
  node.context.remote.runtime.setAttribute(
    node.handle,
    attributeSlotIndex,
    value,
  );
}

function isTextNode(node: SolidLynxNode): boolean {
  return node.kind === 'text';
}

function eventToken(
  node: SolidLynxNode,
  attributeSlotIndex: number,
  eventKey: string,
): string {
  return `${node.handle.id}:${attributeSlotIndex}:${eventKey}`;
}

function serializeValue(
  value: unknown,
  seen: Set<object> = new Set(),
): ElementTemplateSerializableValue {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (Array.isArray(value)) {
    return value.map(item => serializeValue(item, seen));
  }
  if (typeof value !== 'object') {
    return null;
  }
  if (seen.has(value)) {
    throw new Error('SolidLynx properties must be serializable.');
  }

  seen.add(value);
  const result: Record<string, ElementTemplateSerializableValue> = {};
  for (const [key, child] of Object.entries(value)) {
    if (child !== undefined && typeof child !== 'function') {
      result[key] = serializeValue(child, seen);
    }
  }
  seen.delete(value);
  return result;
}

function setDirectAttributeSlot<T>(
  node: SolidLynxNode,
  attributeSlotIndex: number,
  name: string,
  value: T,
  previous?: T,
): void {
  const isEvent = isLynxEventAttributeName(name);
  const token = eventToken(node, attributeSlotIndex, '');
  if (isEvent && typeof previous === 'function') {
    node.context.eventHandlers.delete(token);
  }

  let serialized: ElementTemplateSerializableValue;
  if (isEvent && typeof value === 'function') {
    node.context.eventHandlers.set(
      token,
      value as (event: unknown) => unknown,
    );
    serialized = token;
  } else {
    serialized = serializeValue(value);
  }

  node.context.remote.runtime.setAttribute(
    node.handle,
    attributeSlotIndex,
    serialized,
  );
}

function setProperty<T>(
  node: SolidLynxNode,
  rawName: string,
  value: T,
  previous?: T,
): void {
  const name = rawName === 'className' ? 'class' : rawName;
  const isEvent = isLynxEventAttributeName(name);
  const directAttributeSlotIndex = node.attributeSlots?.[name];
  const attributeSlotIndex = directAttributeSlotIndex
    ?? node.spreadAttributeSlotIndex;
  if (attributeSlotIndex === undefined) {
    throw new Error(
      `SolidLynx template does not define an attribute slot for "${name}".`,
    );
  }
  if (directAttributeSlotIndex !== undefined) {
    setDirectAttributeSlot(
      node,
      directAttributeSlotIndex,
      name,
      value,
      previous,
    );
    return;
  }

  const previousWasEvent = isEvent
    && typeof previous === 'function';
  const eventKey = name;
  if (previousWasEvent) {
    node.context.eventHandlers.delete(
      eventToken(node, attributeSlotIndex, eventKey),
    );
  }

  let serialized: ElementTemplateSerializableValue;
  if (isEvent && typeof value === 'function') {
    const token = eventToken(node, attributeSlotIndex, eventKey);
    node.context.eventHandlers.set(
      token,
      value as (event: unknown) => unknown,
    );
    serialized = token;
  } else {
    serialized = serializeValue(value);
  }

  node.properties[name] = serialized;
  node.context.remote.runtime.setAttribute(
    node.handle,
    attributeSlotIndex,
    node.properties,
  );
}

export function createCompiledTemplateFactory(
  templateKey: string,
): {
  (): SolidLynxNode;
  cloneNode(deep?: boolean): SolidLynxNode;
} {
  const factory = (): SolidLynxNode => {
    const context = getActiveContext();
    const handle = context.remote.runtime.createTemplate({
      templateKey,
      attributeSlots: null,
    });
    return createNode({
      attributeSlots: undefined,
      attachedChildSlotIndex: undefined,
      children: [],
      handle,
      context,
      endChildSlotIndex: undefined,
      kind: 'template',
      ownsHandle: true,
      parent: undefined,
      properties: {},
      spreadAttributeSlotIndex: undefined,
    });
  };
  factory.cloneNode = factory;
  return factory;
}

function createTemplateSlotNode(
  template: SolidLynxNode,
  options: {
    childSlotIndex?: number;
    spreadAttributeSlotIndex?: number;
  },
): SolidLynxNode {
  if (template.kind !== 'template') {
    throw new Error('Element Template slots require a compiled template.');
  }
  return createNode({
    attributeSlots: undefined,
    attachedChildSlotIndex: undefined,
    children: [],
    context: template.context,
    endChildSlotIndex: options.childSlotIndex,
    handle: template.handle,
    kind: 'slot',
    ownsHandle: false,
    parent: undefined,
    properties: {},
    spreadAttributeSlotIndex: options.spreadAttributeSlotIndex,
  });
}

export function setTemplateAttribute<T>(
  template: SolidLynxNode,
  attributeSlotIndex: number,
  name: string,
  value: T,
  previous?: T,
): void {
  setDirectAttributeSlot(
    template,
    attributeSlotIndex,
    name,
    value,
    previous,
  );
}

export function spreadTemplateAttributes<T>(
  template: SolidLynxNode,
  attributeSlotIndex: number,
  accessor: (() => T) | T,
  skipChildren?: boolean,
): void {
  renderer.spread(
    createTemplateSlotNode(template, {
      spreadAttributeSlotIndex: attributeSlotIndex,
    }),
    accessor,
    skipChildren,
  );
}

export function insertTemplateChild<T>(
  template: SolidLynxNode,
  childSlotIndex: number,
  accessor: (() => T) | T,
  initial?: unknown,
): SolidLynxNode {
  return renderer.insert(
    createTemplateSlotNode(template, { childSlotIndex }),
    accessor,
    undefined,
    initial,
  );
}

function detachNode(node: SolidLynxNode): void {
  const parent = node.parent;
  if (parent === undefined) {
    return;
  }
  const index = parent.children.indexOf(node);
  if (index >= 0) {
    parent.children.splice(index, 1);
  }
  node.parent = undefined;
  node.attachedChildSlotIndex = undefined;
}

function insertNodeImpl(
  parent: SolidLynxNode,
  node: SolidLynxNode,
  anchor?: SolidLynxNode,
): void {
  if (!node.ownsHandle) {
    throw new Error(
      'Static nodes inside a compiled SolidLynx template cannot be moved.',
    );
  }
  if (anchor !== undefined && anchor.parent !== parent) {
    throw new Error('The SolidLynx insertion anchor has a different parent.');
  }
  let childSlotIndex: number | undefined;
  if (anchor === undefined) {
    childSlotIndex = parent.endChildSlotIndex;
  } else {
    childSlotIndex = anchor.attachedChildSlotIndex;
  }
  if (childSlotIndex === undefined) {
    throw new Error(
      'SolidLynx template does not define a child slot at this position.',
    );
  }
  parent.context.remote.runtime.insertNode(
    parent.handle,
    childSlotIndex,
    node.handle,
    anchor?.ownsHandle ? anchor.handle : null,
  );
  detachNode(node);
  const anchorIndex = anchor === undefined
    ? -1
    : parent.children.indexOf(anchor);
  if (anchorIndex < 0) {
    parent.children.push(node);
  } else {
    parent.children.splice(anchorIndex, 0, node);
  }
  node.parent = parent;
  node.attachedChildSlotIndex = childSlotIndex;
}

function removeNode(parent: SolidLynxNode, node: SolidLynxNode): void {
  if (!node.ownsHandle || node.attachedChildSlotIndex === undefined) {
    throw new Error(
      'Static nodes inside a compiled SolidLynx template cannot be removed.',
    );
  }
  const releasedIds = parent.context.remote.runtime.removeNode(
    parent.handle,
    node.attachedChildSlotIndex,
    node.handle,
  );
  detachNode(node);

  for (const handleId of releasedIds) {
    const prefix = `${handleId}:`;
    for (const token of parent.context.eventHandlers.keys()) {
      if (token.startsWith(prefix)) {
        parent.context.eventHandlers.delete(token);
      }
    }
  }
}

function getParentNode(node: SolidLynxNode): SolidLynxNode | undefined {
  return node.parent;
}

function getFirstChild(node: SolidLynxNode): SolidLynxNode | undefined {
  return node.children[0];
}

function getNextSibling(node: SolidLynxNode): SolidLynxNode | undefined {
  const parent = node.parent;
  if (parent === undefined) {
    return undefined;
  }
  const index = parent.children.indexOf(node);
  return index < 0 ? undefined : parent.children[index + 1];
}

const renderer: Renderer<SolidLynxNode> = createRenderer<SolidLynxNode>({
  createElement: createElementNode,
  createTextNode: createTextNodeImpl,
  getFirstChild,
  getNextSibling,
  getParentNode,
  insertNode: insertNodeImpl,
  isTextNode,
  removeNode,
  replaceText,
  setProperty,
});

export function renderSolidLynx(
  context: SolidLynxRendererContext,
  code: () => SolidLynxNode,
): () => void {
  activeContext = context;
  const root = createSolidLynxRootNode(context);
  let disposeRenderer: () => void;
  try {
    disposeRenderer = context.remote.api.batch(() => {
      return renderer.render(code, root);
    });
  } catch (error) {
    activeContext = undefined;
    throw error;
  }

  let disposed = false;
  return () => {
    if (disposed) {
      return;
    }
    disposed = true;

    try {
      context.remote.api.batch(() => {
        disposeRenderer();
        for (const child of [...root.children]) {
          removeNode(root, child);
        }
      });
    } finally {
      if (activeContext === context) {
        activeContext = undefined;
      }
    }
  };
}

export function renderSolidLynxInitial(
  context: SolidLynxRendererContext,
  code: () => SolidLynxNode,
): void {
  activeContext = context;
  const root = createSolidLynxRootNode(context);
  try {
    context.remote.api.batch(() => {
      const disposeRenderer = renderer.render(code, root);
      disposeRenderer();
    });
  } finally {
    if (activeContext === context) {
      activeContext = undefined;
    }
  }
}

export const createElement: Renderer<SolidLynxNode>['createElement'] = (
  ...args
) => renderer.createElement(...args);
export const createTextNode: Renderer<SolidLynxNode>['createTextNode'] = (
  ...args
) => renderer.createTextNode(...args);
export const effect: Renderer<SolidLynxNode>['effect'] = (...args) =>
  renderer.effect(...args);

function resolveTextContent(value: unknown): unknown {
  let resolved = value;
  while (typeof resolved === 'function') {
    resolved = (resolved as () => unknown)();
  }
  return resolved;
}

export function setTemplateText<T>(
  template: SolidLynxNode,
  attributeSlotIndex: number,
  accessor: (() => T) | T,
): SolidLynxNode {
  const value = resolveTextContent(accessor);
  if (
    value !== null
    && value !== undefined
    && typeof value !== 'string'
    && typeof value !== 'number'
    && typeof value !== 'boolean'
  ) {
    throw new Error(
      'Dynamic children of a compiled SolidLynx <text> must be text values.',
    );
  }
  template.context.remote.runtime.setAttribute(
    template.handle,
    attributeSlotIndex,
    value === null || value === undefined || typeof value === 'boolean'
      ? ''
      : String(value),
  );
  return template;
}

export const insert: Renderer<SolidLynxNode>['insert'] = (...args) =>
  renderer.insert(...args);
export const insertNode: Renderer<SolidLynxNode>['insertNode'] = (...args) =>
  renderer.insertNode(...args);
export const memo: Renderer<SolidLynxNode>['memo'] = (...args) =>
  renderer.memo(...args);
export const setProp: Renderer<SolidLynxNode>['setProp'] = (...args) =>
  renderer.setProp(...args);
export const spread: Renderer<SolidLynxNode>['spread'] = (...args) =>
  renderer.spread(...args);
export const use: Renderer<SolidLynxNode>['use'] = (...args) =>
  renderer.use(...args);
