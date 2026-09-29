// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  ElementTemplateSerializableValue,
} from '@lynx-js/element-template-runtime';
import {
  BUILTIN_RAW_TEXT_TEMPLATE_KEY,
  ELEMENT_TEMPLATE_SPREAD_ATTRIBUTE_SLOT_INDEX,
  isLynxEventAttributeName,
} from '@lynx-js/element-template-runtime';

import type { SolidLynxNode, SolidLynxRendererContext } from './renderer.js';

let activeContext: SolidLynxRendererContext | undefined;

function getActiveContext(): SolidLynxRendererContext {
  if (activeContext === undefined) {
    throw new Error(
      'SolidLynx renderer is not attached to an active root.',
    );
  }
  return activeContext;
}

function createRootNode(
  context: SolidLynxRendererContext,
): SolidLynxNode {
  return {
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
  };
}

export function createElement(tag: string): SolidLynxNode {
  const context = getActiveContext();
  const properties: Record<string, ElementTemplateSerializableValue> = {};
  return {
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
  };
}

export function createTextNode(value: string): SolidLynxNode {
  const context = getActiveContext();
  return {
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
  };
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

export function setProp<T>(
  node: SolidLynxNode,
  rawName: string,
  value: T,
  previous?: T,
): void {
  const name = rawName === 'className' ? 'class' : rawName;
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

  const isEvent = isLynxEventAttributeName(name);
  const token = eventToken(node, attributeSlotIndex, name);
  if (isEvent && typeof previous === 'function') {
    node.context.eventHandlers.delete(token);
  }
  if (isEvent && typeof value === 'function') {
    node.context.eventHandlers.set(
      token,
      value as (event: unknown) => unknown,
    );
    node.properties[name] = token;
  } else {
    node.properties[name] = serializeValue(value);
  }
  node.context.remote.runtime.setAttribute(
    node.handle,
    attributeSlotIndex,
    node.properties,
  );
}

export function createTemplate(
  templateKey: string,
): {
  (): SolidLynxNode;
  cloneNode(deep?: boolean): SolidLynxNode;
} {
  const factory = (): SolidLynxNode => {
    const context = getActiveContext();
    return {
      attributeSlots: undefined,
      attachedChildSlotIndex: undefined,
      children: [],
      context,
      endChildSlotIndex: undefined,
      handle: context.remote.runtime.createTemplate({
        templateKey,
        attributeSlots: null,
      }),
      kind: 'template',
      ownsHandle: true,
      parent: undefined,
      properties: {},
      spreadAttributeSlotIndex: undefined,
    };
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
  return {
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
  };
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

export function insertNode(
  parent: SolidLynxNode,
  node: SolidLynxNode,
  anchor?: SolidLynxNode,
): void {
  if (!node.ownsHandle) {
    throw new Error(
      'Static nodes inside a compiled SolidLynx template cannot be moved.',
    );
  }
  const childSlotIndex = anchor === undefined
    ? parent.endChildSlotIndex
    : anchor.attachedChildSlotIndex;
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

function resolveValue(value: unknown): unknown {
  let resolved = value;
  while (typeof resolved === 'function') {
    resolved = (resolved as () => unknown)();
  }
  return resolved;
}

function insertValue(parent: SolidLynxNode, value: unknown): void {
  const resolved = resolveValue(value);
  if (
    resolved === null
    || resolved === undefined
    || typeof resolved === 'boolean'
  ) {
    return;
  }
  if (Array.isArray(resolved)) {
    for (const child of resolved) {
      insertValue(parent, child);
    }
    return;
  }
  if (
    typeof resolved === 'object'
    && 'handle' in resolved
    && 'ownsHandle' in resolved
  ) {
    insertNode(parent, resolved as SolidLynxNode);
    return;
  }
  if (typeof resolved === 'object') {
    throw new Error(
      'SolidLynx dynamic children must resolve to nodes or text values.',
    );
  }
  if (
    typeof resolved === 'string'
    || typeof resolved === 'number'
    || typeof resolved === 'bigint'
  ) {
    insertNode(parent, createTextNode(String(resolved)));
    return;
  }
  throw new Error(
    'SolidLynx dynamic children must resolve to nodes or text values.',
  );
}

export function insert(
  parent: SolidLynxNode,
  accessor: unknown,
): SolidLynxNode {
  insertValue(parent, accessor);
  return parent;
}

export function insertTemplateChild(
  template: SolidLynxNode,
  childSlotIndex: number,
  accessor: unknown,
): SolidLynxNode {
  insertValue(
    createTemplateSlotNode(template, { childSlotIndex }),
    accessor,
  );
  return template;
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

export function setTemplateText<T>(
  template: SolidLynxNode,
  attributeSlotIndex: number,
  accessor: (() => T) | T,
): SolidLynxNode {
  const value = resolveValue(accessor);
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

export function spread(
  node: SolidLynxNode,
  accessor: unknown,
): void {
  const properties = resolveValue(accessor);
  if (typeof properties !== 'object' || properties === null) {
    return;
  }
  for (const [name, value] of Object.entries(properties)) {
    setProp(node, name, value);
  }
}

export function spreadTemplateAttributes(
  template: SolidLynxNode,
  attributeSlotIndex: number,
  accessor: unknown,
): void {
  spread(
    createTemplateSlotNode(template, {
      spreadAttributeSlotIndex: attributeSlotIndex,
    }),
    accessor,
  );
}

export function memo<T>(compute: () => T): () => T {
  const value = compute();
  return () => value;
}

export function effect<T>(
  compute: (previous?: T) => T,
  initialValue?: T,
): void {
  compute(initialValue);
}

export function use<T>(
  directive: (element: SolidLynxNode, value: T) => void,
  element: SolidLynxNode,
  value: T,
): void {
  directive(element, value);
}

export const setAttribute: typeof setProp = setProp;
export const setProperty: typeof setProp = setProp;

export function className(
  node: SolidLynxNode,
  value: unknown,
): void {
  setProp(node, 'class', value);
}

export function renderSolidLynxInitial(
  context: SolidLynxRendererContext,
  code: () => SolidLynxNode,
): void {
  activeContext = context;
  try {
    context.remote.api.batch(() => {
      insertValue(createRootNode(context), code());
    });
  } finally {
    if (activeContext === context) {
      activeContext = undefined;
    }
  }
}
