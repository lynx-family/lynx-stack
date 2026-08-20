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
  __typedElementType?: string;
  __attributeSlots?: unknown[] | null;
  __childSlots?: Array<unknown[] | null | undefined> | null;
  __bundleUrl?: string;
  __options?: Record<string, unknown> | null;
}

type CompiledAttributeDescriptor =
  | { kind: 'static'; key: string; value: unknown }
  | { kind: 'slot'; key: string; attrSlotIndex: number }
  | { kind: 'spread'; attrSlotIndex: number };

interface CompiledElementNode {
  kind: 'element';
  type: string;
  attributesArray?: CompiledAttributeDescriptor[];
  children?: CompiledTemplateChild[];
  parts?: Record<string, unknown>;
}

interface CompiledChildSlotNode {
  kind: 'childSlot';
  type: 'slot';
  elementSlotIndex: number;
}

type CompiledTemplateChild = CompiledElementNode | CompiledChildSlotNode;

function isCompiledElementNode(node: unknown): node is CompiledElementNode {
  return isRecord(node) && node['kind'] === 'element' && typeof node['type'] === 'string';
}

function isCompiledChildSlotNode(node: unknown): node is CompiledChildSlotNode {
  return isRecord(node)
    && node['kind'] === 'childSlot'
    && node['type'] === 'slot'
    && typeof node['elementSlotIndex'] === 'number';
}

function applyCompiledAttributes(
  node: CompiledElementNode,
  attributeSlots: unknown[] | null | undefined,
): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};

  for (const descriptor of node.attributesArray ?? []) {
    if (descriptor.kind === 'static') {
      attributes[descriptor.key] = descriptor.value;
      continue;
    }

    if (descriptor.kind === 'slot') {
      const slotValue = attributeSlots?.[descriptor.attrSlotIndex];
      if (slotValue !== null && slotValue !== undefined) {
        attributes[descriptor.key] = slotValue;
      }
      continue;
    }

    const spreadValue = attributeSlots?.[descriptor.attrSlotIndex];
    if (isRecord(spreadValue)) {
      Object.assign(attributes, spreadValue);
    }
  }

  return attributes;
}

function instantiateCompiledTemplateChild(
  child: CompiledTemplateChild,
  attributeSlots: unknown[] | null | undefined,
  childSlots: Array<unknown[] | null | undefined> | null | undefined,
): unknown {
  if (isCompiledChildSlotNode(child)) {
    return {
      tag: 'slot',
      attributes: { 'slot-id': child.elementSlotIndex },
      children: [...(childSlots?.[child.elementSlotIndex] ?? [])],
    };
  }

  return instantiateCompiledTemplateNode(child, attributeSlots, childSlots);
}

export function instantiateCompiledTemplateNode(
  node: CompiledElementNode,
  attributeSlots: unknown[] | null | undefined,
  childSlots: Array<unknown[] | null | undefined> | null | undefined,
): CompiledTemplateNode {
  const instantiatedChildren: unknown[] = [];
  for (const child of node.children ?? []) {
    instantiatedChildren.push(
      instantiateCompiledTemplateChild(child, attributeSlots, childSlots),
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
  childSlots: Array<unknown[] | null | undefined> | null | undefined,
): CompiledTemplateNode {
  if (!isCompiledElementNode(template)) {
    throw new Error('ElementTemplate: __CreateElementTemplate expects the new compiled template schema.');
  }

  return instantiateCompiledTemplateNode(template, attributeSlots, childSlots);
}

function collectChildSlotsFromInstance(root: CompiledTemplateNode): unknown[][] {
  const childSlots: unknown[][] = [];
  const children = root.children;
  if (!isUnknownArray(children)) {
    return childSlots;
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
    childSlots[slotId] = isUnknownArray(slotChildren) ? [...slotChildren] : [];
  }

  return childSlots;
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

function copyAttributeSlotsForMock(value: unknown): unknown[] {
  return isUnknownArray(value) ? value.slice() : [];
}

function rebuildTemplateInstance(root: CompiledTemplateNode): void {
  const compiledTemplate = root.__compiledTemplate;
  if (!compiledTemplate) {
    return;
  }

  const attributeSlots = copyAttributeSlotsForMock(root.__attributeSlots);
  const childSlots = collectChildSlotsFromInstance(root);
  const next = instantiateCompiledTemplate(compiledTemplate, attributeSlots, childSlots);
  assignTemplateInstance(root, next);
}

function detachNodeFromChildSlots(
  childSlots: Array<unknown[] | null | undefined>,
  node: unknown,
): void {
  for (let slotIndex = 0; slotIndex < childSlots.length; slotIndex += 1) {
    const children = childSlots[slotIndex];
    if (!children) {
      continue;
    }
    const existingIndex = children.indexOf(node);
    if (existingIndex >= 0) {
      childSlots[slotIndex] = [
        ...children.slice(0, existingIndex),
        ...children.slice(existingIndex + 1),
      ];
    }
  }
}

function insertNodeIntoChildSlot(
  childSlots: Array<unknown[] | null | undefined>,
  childSlotIndex: number,
  node: unknown,
  referenceNode?: unknown,
): void {
  const targetChildren = [...(childSlots[childSlotIndex] ?? [])];
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
  childSlots[childSlotIndex] = targetChildren;
}

function removeNodeFromChildSlot(
  childSlots: Array<unknown[] | null | undefined>,
  childSlotIndex: number,
  node: unknown,
): void {
  const targetChildren = [...(childSlots[childSlotIndex] ?? [])];
  const index = targetChildren.indexOf(node);
  if (index >= 0) {
    targetChildren.splice(index, 1);
  }
  childSlots[childSlotIndex] = targetChildren;
}

function commitTypedChildSlots(
  root: CompiledTemplateNode,
  childSlots: Array<unknown[] | null | undefined>,
): void {
  root.__childSlots = childSlots;
  root.children = childSlots[0] ?? [];
}

export function setAttributeSlotOnTemplateInstance(
  root: CompiledTemplateNode,
  attrSlotIndex: number,
  value: unknown,
): void {
  const attributeSlots = copyAttributeSlotsForMock(root.__attributeSlots);
  attributeSlots[attrSlotIndex] = value;
  root.__attributeSlots = attributeSlots;

  if (root.__typedElementType) {
    root.attributes = attrSlotIndex === 0 && isRecord(value) ? { ...value } : {};
    return;
  }

  rebuildTemplateInstance(root);
}

export function insertNodeIntoTemplateInstance(
  root: CompiledTemplateNode,
  childSlotIndex: number,
  node: unknown,
  referenceNode?: unknown,
): void {
  if (root.__typedElementType) {
    const childSlots = isUnknownArray(root.__childSlots) ? [...root.__childSlots] : [];
    detachNodeFromChildSlots(childSlots, node);
    insertNodeIntoChildSlot(childSlots, childSlotIndex, node, referenceNode);
    commitTypedChildSlots(root, childSlots);
    return;
  }

  if (!root.__compiledTemplate) {
    return;
  }
  const attributeSlots = copyAttributeSlotsForMock(root.__attributeSlots);
  const childSlots = collectChildSlotsFromInstance(root);
  detachNodeFromChildSlots(childSlots, node);
  insertNodeIntoChildSlot(childSlots, childSlotIndex, node, referenceNode);
  root.__attributeSlots = attributeSlots;
  const next = instantiateCompiledTemplate(root.__compiledTemplate, attributeSlots, childSlots);
  assignTemplateInstance(root, next);
}

export function removeNodeFromTemplateInstance(
  root: CompiledTemplateNode,
  childSlotIndex: number,
  node: unknown,
): void {
  if (root.__typedElementType) {
    const childSlots = isUnknownArray(root.__childSlots) ? [...root.__childSlots] : [];
    removeNodeFromChildSlot(childSlots, childSlotIndex, node);
    commitTypedChildSlots(root, childSlots);
    return;
  }

  if (!root.__compiledTemplate) {
    return;
  }
  const attributeSlots = copyAttributeSlotsForMock(root.__attributeSlots);
  const childSlots = collectChildSlotsFromInstance(root);
  removeNodeFromChildSlot(childSlots, childSlotIndex, node);
  root.__attributeSlots = attributeSlots;
  const next = instantiateCompiledTemplate(root.__compiledTemplate, attributeSlots, childSlots);
  assignTemplateInstance(root, next);
}

type SerializableValueForMock =
  | string
  | number
  | boolean
  | null
  | SerializableValueForMock[]
  | { [key: string]: SerializableValueForMock };

interface SerializedEtNodeBaseForMock {
  attributeSlots?: SerializableValueForMock[] | null;
  childSlots?: Array<SerializedEtNodeForMock[] | null | undefined> | null;
  uid: number;
  options?: Record<string, SerializableValueForMock> | null;
}

interface SerializedCompiledNodeForMock extends SerializedEtNodeBaseForMock {
  templateKey: string;
  bundleUrl?: string;
  attributeSlots?: SerializableValueForMock[] | null;
}

interface SerializedTypedNodeForMock extends SerializedEtNodeBaseForMock {
  tag: string;
  attributes?: SerializableValueForMock | null;
}

interface SerializedTypedListOptionsForMock {
  listChildren: SerializedEtNodeForMock[];
}

interface SerializedTypedListNodeForMock extends Omit<SerializedEtNodeBaseForMock, 'options'> {
  tag: 'list';
  attributes?: SerializableValueForMock | null;
  options?: SerializedTypedListOptionsForMock | null;
}

type SerializedEtNodeForMock =
  | SerializedCompiledNodeForMock
  | SerializedTypedNodeForMock
  | SerializedTypedListNodeForMock;

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
    if (descriptor.kind === 'slot') {
      const slotValue = attributeSlots[descriptor.attrSlotIndex];
      if (slotValue !== null && slotValue !== undefined) {
        attrs[descriptor.key] = slotValue;
      }
      continue;
    }

    if (descriptor.kind !== 'spread') {
      continue;
    }

    const slotValue = attributeSlots[descriptor.attrSlotIndex];
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

function isTemplateInstanceForSerialization(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && (typeof value['templateId'] === 'string' || typeof value['__typedElementType'] === 'string');
}

function serializePlainSerializableValue(value: unknown): SerializableValueForMock | undefined {
  if (
    typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
    || value === null
  ) {
    return value;
  }

  if (isUnknownArray(value)) {
    return value.map((item) => serializePlainSerializableValue(item) ?? null);
  }

  if (isTemplateInstanceForSerialization(value) || !isRecord(value)) {
    return undefined;
  }

  const serialized: Record<string, SerializableValueForMock> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    const nextValue = serializePlainSerializableValue(nestedValue);
    if (nextValue !== undefined) {
      serialized[key] = nextValue;
    }
  }
  return serialized;
}

function serializeRuntimeOptions(
  value: unknown,
): Record<string, SerializableValueForMock> | undefined {
  if (!isRecord(value) || isTemplateInstanceForSerialization(value)) {
    return undefined;
  }

  const serialized: Record<string, SerializableValueForMock> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    const nextValue = serializePlainSerializableValue(nestedValue);
    if (nextValue !== undefined) {
      serialized[key] = nextValue;
    }
  }
  return serialized;
}

function serializeTypedListOptions(
  value: unknown,
): SerializedTypedListOptionsForMock | undefined {
  if (!isRecord(value) || isTemplateInstanceForSerialization(value)) {
    return undefined;
  }
  const listChildren = value['listChildren'];
  if (!isUnknownArray(listChildren)) {
    return undefined;
  }

  const genericOptions: Record<string, SerializableValueForMock> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (key === 'listChildren') {
      continue;
    }
    const nextValue = serializePlainSerializableValue(nestedValue);
    if (nextValue !== undefined) {
      genericOptions[key] = nextValue;
    }
  }

  const serializedChildren: SerializedEtNodeForMock[] = [];
  for (const child of listChildren) {
    if (isTemplateInstanceForSerialization(child)) {
      serializedChildren.push(serializeTemplateNode(child));
    }
  }
  return {
    ...genericOptions,
    listChildren: serializedChildren,
  };
}

function normalizeAttributeSlots(value: unknown): SerializableValueForMock[] {
  return isUnknownArray(value)
    ? value.map((slotValue) => serializePlainSerializableValue(slotValue) ?? null)
    : [];
}

function serializeChildSlotsFromSlots(
  childSlots: Array<unknown[] | null | undefined> | null | undefined,
): Array<SerializedEtNodeForMock[] | null | undefined> {
  const serializedSlots: Array<SerializedEtNodeForMock[] | null | undefined> = [];
  if (!isUnknownArray(childSlots)) {
    return serializedSlots;
  }

  for (let slotId = 0; slotId < childSlots.length; slotId += 1) {
    const slotChildren = childSlots[slotId];
    if (slotChildren == null) {
      if (slotId in childSlots) {
        serializedSlots[slotId] = slotChildren;
      }
      continue;
    }
    if (!isUnknownArray(slotChildren)) {
      continue;
    }

    const serializedChildren: SerializedEtNodeForMock[] = [];
    for (const childNode of slotChildren) {
      if (isTemplateInstanceForSerialization(childNode)) {
        serializedChildren.push(serializeTemplateNode(childNode));
      }
    }
    serializedSlots[slotId] = serializedChildren;
  }

  return serializedSlots;
}

function serializeCompiledChildSlotsFromChildren(
  root: Record<string, unknown>,
): SerializedEtNodeForMock[][] {
  const serializedSlots: SerializedEtNodeForMock[][] = [];
  const children = root['children'];
  if (!isUnknownArray(children)) {
    return serializedSlots;
  }

  for (const child of children) {
    if (!isRecord(child)) {
      continue;
    }

    const slotId = getSlotId(child);
    if (slotId === undefined) {
      continue;
    }

    const slotChildren: SerializedEtNodeForMock[] = [];
    const childNodes = child['children'];
    if (isUnknownArray(childNodes)) {
      for (const childNode of childNodes) {
        if (isTemplateInstanceForSerialization(childNode)) {
          slotChildren.push(serializeTemplateNode(childNode));
        }
      }
    }

    serializedSlots[slotId] = slotChildren;
  }

  return serializedSlots;
}

function serializeTemplateNode(
  root: unknown,
): SerializedEtNodeForMock {
  if (!isRecord(root) || !isTemplateInstanceForSerialization(root)) {
    throw new Error('ElementTemplate: __SerializeElementTemplate expects a template instance.');
  }

  const handleId = root['__handleId'];
  if (typeof handleId !== 'number') {
    throw new Error('ElementTemplate: __SerializeElementTemplate expects a template instance handleId.');
  }

  if (typeof root['__typedElementType'] === 'string') {
    const typedElementType = root['__typedElementType'];
    const attributeSlots = normalizeAttributeSlots(root['__attributeSlots']);
    const childSlots = isUnknownArray(root['__childSlots'])
      ? serializeChildSlotsFromSlots(root['__childSlots'])
      : null;
    if (typedElementType === 'list') {
      const options = serializeTypedListOptions(root['__options']);
      return {
        tag: 'list',
        attributes: attributeSlots[0] ?? null,
        childSlots,
        uid: handleId,
        ...(options ? { options } : {}),
      };
    }

    const options = serializeRuntimeOptions(root['__options']);
    return {
      tag: typedElementType,
      attributes: attributeSlots[0] ?? null,
      childSlots,
      uid: handleId,
      ...(options ? { options } : {}),
    };
  }

  const templateId = root['templateId'];
  const bundleUrl = root['__bundleUrl'];
  const options = serializeRuntimeOptions(root['__options']);
  return {
    templateKey: templateId === '_et_builtin_raw_text' ? '_et_builtin_raw_text' : String(templateId),
    ...(typeof bundleUrl === 'string' ? { bundleUrl } : {}),
    attributeSlots: templateId === '_et_builtin_raw_text'
      ? [String((isRecord(root['attributes']) ? root['attributes']?.['text'] : '') ?? '')]
      : normalizeAttributeSlots(root['__attributeSlots']),
    childSlots: serializeCompiledChildSlotsFromChildren(root),
    uid: handleId,
    ...(options ? { options } : {}),
  };
}

export function serializeTemplateInstance(root: unknown): SerializedEtNodeForMock {
  return serializeTemplateNode(root);
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
        childSlots: ops[i + 5],
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
        childSlotIndex: ops[i + 2],
        child: ops[i + 3],
        reference: ops[i + 4],
      });
      i += 5;
    } else if (opcode === 4) {
      res.push({
        type: 'removeNode',
        id: ops[i + 1],
        childSlotIndex: ops[i + 2],
        child: ops[i + 3],
      });
      i += 4;
    } else if (opcode === 5) {
      res.push({
        type: 'createTypedElement',
        id: ops[i + 1],
        elementType: ops[i + 2],
        attributes: ops[i + 3],
        childSlots: ops[i + 4],
        options: ops[i + 5],
      });
      i += 6;
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
