function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export interface CompiledTemplateNode {
  tag?: string;
  templateId?: string;
  attributes?: Record<string, unknown>;
  parts?: Record<string, unknown>;
  children?: unknown[];
  type?: string;
  text?: string;
  __handleId?: number;
  __compiledTemplate?: CompiledElementNode;
  __attributeSlots?: unknown[] | null;
  __options?: Record<string, unknown>;
}

interface CompiledAttributeDescriptor {
  kind: 'attribute' | 'spread';
  binding: 'static' | 'slot';
  key?: string;
  value?: unknown;
  attrSlotIndex?: number;
}

interface CompiledElementNode {
  kind: 'element';
  type: string;
  attributesArray?: CompiledAttributeDescriptor[];
  children?: CompiledTemplateChild[];
  parts?: Record<string, unknown>;
}

interface CompiledElementSlotNode {
  kind: 'elementSlot';
  type: 'slot';
  elementSlotIndex: number;
}

type CompiledTemplateChild = CompiledElementNode | CompiledElementSlotNode;

function isCompiledElementNode(node: unknown): node is CompiledElementNode {
  return isRecord(node) && node['kind'] === 'element' && typeof node['type'] === 'string';
}

function isCompiledElementSlotNode(node: unknown): node is CompiledElementSlotNode {
  return isRecord(node)
    && node['kind'] === 'elementSlot'
    && node['type'] === 'slot'
    && typeof node['elementSlotIndex'] === 'number';
}

function applyCompiledAttributes(
  node: CompiledElementNode,
  attributeSlots: unknown[] | null | undefined,
): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};

  for (const descriptor of node.attributesArray ?? []) {
    if (descriptor.kind === 'attribute') {
      if (descriptor.binding === 'static') {
        if (descriptor.key) {
          attributes[descriptor.key] = descriptor.value;
        }
        continue;
      }

      if (descriptor.key) {
        const slotValue = attributeSlots?.[descriptor.attrSlotIndex ?? -1];
        if (slotValue !== null && slotValue !== undefined) {
          attributes[descriptor.key] = slotValue;
        }
      }
      continue;
    }

    const spreadValue = attributeSlots?.[descriptor.attrSlotIndex ?? -1];
    if (isRecord(spreadValue)) {
      Object.assign(attributes, spreadValue);
    }
  }

  return attributes;
}

function instantiateCompiledTemplateChild(
  child: CompiledTemplateChild,
  attributeSlots: unknown[] | null | undefined,
  elementSlots: unknown[][] | null | undefined,
): unknown {
  if (isCompiledElementSlotNode(child)) {
    return {
      tag: 'slot',
      attributes: { 'slot-id': child.elementSlotIndex },
      children: [...(elementSlots?.[child.elementSlotIndex] ?? [])],
    };
  }

  return instantiateCompiledTemplateNode(child, attributeSlots, elementSlots);
}

export function instantiateCompiledTemplateNode(
  node: CompiledElementNode,
  attributeSlots: unknown[] | null | undefined,
  elementSlots: unknown[][] | null | undefined,
): CompiledTemplateNode {
  const instantiatedChildren: unknown[] = [];
  for (const child of node.children ?? []) {
    instantiatedChildren.push(
      instantiateCompiledTemplateChild(child, attributeSlots, elementSlots),
    );
  }

  return {
    tag: node.type,
    attributes: applyCompiledAttributes(node, attributeSlots),
    ...(isRecord(node.parts) ? { parts: { ...node.parts } } : {}),
    children: instantiatedChildren,
  };
}

export function instantiateCompiledTemplate(
  template: unknown,
  attributeSlots: unknown[] | null | undefined,
  elementSlots: unknown[][] | null | undefined,
): CompiledTemplateNode {
  if (!isCompiledElementNode(template)) {
    throw new Error('ElementTemplate: __CreateElementTemplate expects the new compiled template schema.');
  }

  return instantiateCompiledTemplateNode(template, attributeSlots, elementSlots);
}

function collectElementSlotsFromInstance(root: CompiledTemplateNode): unknown[][] {
  const elementSlots: unknown[][] = [];
  const children = root.children;
  if (!isUnknownArray(children)) {
    return elementSlots;
  }

  for (const child of children) {
    if (!isRecord(child)) {
      continue;
    }
    const slotId = getSlotId(child);
    if (slotId === undefined) {
      continue;
    }
    const slotChildren = child.children;
    elementSlots[slotId] = isUnknownArray(slotChildren) ? [...slotChildren] : [];
  }

  return elementSlots;
}

function assignTemplateInstance(
  target: CompiledTemplateNode,
  next: CompiledTemplateNode,
): void {
  target.tag = next.tag;
  target.attributes = next.attributes;
  if (next.parts) {
    target.parts = next.parts;
  } else {
    delete target.parts;
  }
  target.children = next.children;
}

function rebuildTemplateInstance(root: CompiledTemplateNode): void {
  const compiledTemplate = root.__compiledTemplate;
  if (!compiledTemplate) {
    return;
  }

  const attributeSlots = normalizeAttributeSlots(root.__attributeSlots);
  const elementSlots = collectElementSlotsFromInstance(root);
  const next = instantiateCompiledTemplate(compiledTemplate, attributeSlots, elementSlots);
  assignTemplateInstance(root, next);
}

export function setAttributeSlotOnTemplateInstance(
  root: CompiledTemplateNode,
  attrSlotIndex: number,
  value: unknown,
): void {
  const attributeSlots = normalizeAttributeSlots(root.__attributeSlots);
  attributeSlots[attrSlotIndex] = value;
  root.__attributeSlots = attributeSlots;
  rebuildTemplateInstance(root);
}

export function insertNodeIntoTemplateInstance(
  root: CompiledTemplateNode,
  elementSlotIndex: number,
  node: unknown,
  referenceNode?: unknown,
): void {
  if (!root.__compiledTemplate) {
    return;
  }
  const attributeSlots = normalizeAttributeSlots(root.__attributeSlots);
  const elementSlots = collectElementSlotsFromInstance(root);
  for (let slotIndex = 0; slotIndex < elementSlots.length; slotIndex += 1) {
    const children = elementSlots[slotIndex];
    if (!children) {
      continue;
    }
    const existingIndex = children.indexOf(node);
    if (existingIndex >= 0) {
      elementSlots[slotIndex] = [
        ...children.slice(0, existingIndex),
        ...children.slice(existingIndex + 1),
      ];
    }
  }

  const targetChildren = [...(elementSlots[elementSlotIndex] ?? [])];
  if (referenceNode == null) {
    targetChildren.push(node);
  } else {
    const beforeIndex = targetChildren.indexOf(referenceNode);
    if (beforeIndex >= 0) {
      targetChildren.splice(beforeIndex, 0, node);
    } else {
      targetChildren.push(node);
    }
  }

  elementSlots[elementSlotIndex] = targetChildren;
  root.__attributeSlots = attributeSlots;
  const next = instantiateCompiledTemplate(root.__compiledTemplate, attributeSlots, elementSlots);
  assignTemplateInstance(root, next);
}

export function removeNodeFromTemplateInstance(
  root: CompiledTemplateNode,
  elementSlotIndex: number,
  node: unknown,
): void {
  if (!root.__compiledTemplate) {
    return;
  }
  const attributeSlots = normalizeAttributeSlots(root.__attributeSlots);
  const elementSlots = collectElementSlotsFromInstance(root);
  const targetChildren = [...(elementSlots[elementSlotIndex] ?? [])];
  const index = targetChildren.indexOf(node);
  if (index >= 0) {
    targetChildren.splice(index, 1);
  }
  elementSlots[elementSlotIndex] = targetChildren;
  root.__attributeSlots = attributeSlots;
  const next = instantiateCompiledTemplate(root.__compiledTemplate, attributeSlots, elementSlots);
  assignTemplateInstance(root, next);
}

type SerializableValueForMock =
  | string
  | number
  | boolean
  | null
  | SerializableValueForMock[]
  | { [key: string]: SerializableValueForMock };

interface SerializedElementTemplateForMock {
  templateKey: string;
  bundleUrl?: string;
  attributeSlots: SerializableValueForMock[];
  elementSlots: SerializedElementTemplateForMock[][];
  uid: number | string;
}

function getSlotId(node: Record<string, unknown>): number | undefined {
  const attrs = node['attributes'];
  if (!isRecord(attrs)) {
    return undefined;
  }

  const slotId = attrs['slot-id'];
  if (typeof slotId === 'string' || typeof slotId === 'number') {
    return Number(slotId);
  }

  return undefined;
}

function decodeDynamicAttrsForNode(
  compiledTemplate: CompiledElementNode,
  attributeSlots: unknown[],
): Record<string, unknown> | undefined {
  const attrs: Record<string, unknown> = {};

  for (const descriptor of compiledTemplate.attributesArray ?? []) {
    if (descriptor.binding !== 'slot') {
      continue;
    }

    const slotValue = attributeSlots[descriptor.attrSlotIndex ?? -1];
    if (descriptor.kind === 'attribute') {
      if (descriptor.key && slotValue !== null && slotValue !== undefined) {
        attrs[descriptor.key] = slotValue;
      }
      continue;
    }

    if (!isRecord(slotValue)) {
      continue;
    }
    for (const [key, value] of Object.entries(slotValue)) {
      if (key === '__spread') {
        continue;
      }
      attrs[key] = value;
    }
  }

  return Object.keys(attrs).length > 0 ? attrs : undefined;
}

function decodeDynamicAttrsFromTemplate(
  compiledTemplate: CompiledElementNode | undefined,
  attributeSlots: unknown[] | null | undefined,
): Record<number, Record<string, unknown>> | undefined {
  if (!compiledTemplate || !attributeSlots) {
    return undefined;
  }

  let nextPartId = 0;
  const attrsByPartId: Record<number, Record<string, unknown>> = {};

  const visit = (node: CompiledElementNode): void => {
    const attrs = decodeDynamicAttrsForNode(node, attributeSlots);
    if (attrs) {
      attrsByPartId[nextPartId++] = attrs;
    }

    for (const child of node.children ?? []) {
      if (isCompiledElementNode(child)) {
        visit(child);
      }
    }
  };

  visit(compiledTemplate);

  return Object.keys(attrsByPartId).length > 0 ? attrsByPartId : undefined;
}

function normalizeAttributeSlots(
  value: unknown,
): SerializableValueForMock[] {
  return isUnknownArray(value) ? (value as SerializableValueForMock[]) : [];
}

function serializeTemplateNode(
  root: unknown,
): SerializedElementTemplateForMock {
  if (!isRecord(root) || typeof root['templateId'] !== 'string') {
    throw new Error('ElementTemplate: __SerializeElementTemplate expects a template instance.');
  }

  const handleId = root['__handleId'];
  if (typeof handleId !== 'number') {
    throw new Error('ElementTemplate: __SerializeElementTemplate expects a template instance handleId.');
  }

  const templateId = root['templateId'];
  const serializedSlots: SerializedElementTemplateForMock[][] = [];
  const children = root['children'];
  if (isUnknownArray(children)) {
    for (const child of children) {
      if (!isRecord(child)) {
        continue;
      }

      const slotId = getSlotId(child);
      if (slotId === undefined) {
        continue;
      }

      const slotChildren: SerializedElementTemplateForMock[] = [];
      const childNodes = child['children'];
      if (isUnknownArray(childNodes)) {
        for (const childNode of childNodes) {
          if (!isRecord(childNode) || typeof childNode['templateId'] !== 'string') {
            continue;
          }
          slotChildren.push(
            serializeTemplateNode(childNode) as SerializedElementTemplateForMock,
          );
        }
      }

      serializedSlots[slotId] = slotChildren;
    }
  }

  return {
    templateKey: templateId === '__et_builtin_raw_text__' ? '__et_builtin_raw_text__' : templateId,
    attributeSlots: templateId === '__et_builtin_raw_text__'
      ? [String((isRecord(root['attributes']) ? root['attributes']?.['text'] : '') ?? '')]
      : normalizeAttributeSlots(root['__attributeSlots']),
    elementSlots: serializedSlots,
    uid: handleId,
  };
}

export function serializeTemplateInstance(root: unknown): SerializedElementTemplateForMock {
  return serializeTemplateNode(root) as SerializedElementTemplateForMock;
}

export function formatUpdateCommands(ops: unknown): unknown {
  if (!isUnknownArray(ops)) return ops;
  const res: unknown[] = [];
  for (let i = 0; i < ops.length;) {
    const opcode = ops[i];
    if (opcode === 1) {
      const maybeOptions = ops[i + 6];
      const hasOptions = maybeOptions == null || isRecord(maybeOptions);
      res.push({
        type: 'createTemplate',
        id: ops[i + 1],
        template: ops[i + 2],
        bundleUrl: ops[i + 3],
        attributeSlots: ops[i + 4],
        elementSlots: ops[i + 5],
        ...(hasOptions ? { options: maybeOptions } : {}),
      });
      i += hasOptions ? 7 : 6;
    } else if (opcode === 2) {
      res.push({
        type: 'setAttribute',
        id: ops[i + 1],
        attrSlotIndex: ops[i + 2],
        value: ops[i + 3],
      });
      i += 4;
    } else if (opcode === 3) {
      res.push({
        type: 'insertNode',
        id: ops[i + 1],
        elementSlotIndex: ops[i + 2],
        child: ops[i + 3],
        reference: ops[i + 4],
      });
      i += 5;
    } else if (opcode === 4) {
      res.push({
        type: 'removeNode',
        id: ops[i + 1],
        elementSlotIndex: ops[i + 2],
        child: ops[i + 3],
      });
      i += 4;
    } else {
      res.push(opcode);
      i += 1;
    }
  }
  return res;
}

export function formatNode(node: unknown): string {
  if (typeof node === 'string') {
    return node;
  }
  if (isRecord(node)) {
    const templateId = node['templateId'];
    const tag = node['tag'];
    const displayTag = typeof templateId === 'string'
      ? templateId
      : (typeof tag === 'string' ? tag : undefined);
    if (displayTag) {
      return `<${displayTag} />`;
    }

    const text = node['text'];
    if (typeof text === 'string') {
      return `"${text}"`;
    }

    const id = node['id'];
    if (typeof id === 'string' || typeof id === 'number') {
      return String(id);
    }

    const type = node['type'];
    if (typeof type === 'string') {
      return type;
    }
  }
  return String(node);
}

export function isRecordForMock(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}

export function isUnknownArrayForMock(value: unknown): value is unknown[] {
  return isUnknownArray(value);
}
