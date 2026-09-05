// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { SerializedSnapshotInstance, SnapshotType } from './types.js';

const COMPACT_SNAPSHOT_VERSION = 1;

const SnapshotField = {
  values: 1 << 0,
  listItemPlatformInfo: 1 << 1,
  extraProps: 1 << 2,
  children: 1 << 3,
  slotIndex: 1 << 4,
} as const;

const ALL_SNAPSHOT_FIELDS = SnapshotField.values
  | SnapshotField.listItemPlatformInfo
  | SnapshotField.extraProps
  | SnapshotField.children
  | SnapshotField.slotIndex;

const FIELD_COUNT_BY_MASK = [
  0,
  1,
  1,
  2,
  1,
  2,
  2,
  3,
  1,
  2,
  2,
  3,
  2,
  3,
  3,
  4,
] as const;

export type CompactSnapshotInstance = [
  id: number,
  typeIndex: number,
  fieldMask: number,
  ...fields: unknown[],
];

export type CompactSnapshotSerialization = [
  version: typeof COMPACT_SNAPSHOT_VERSION,
  typeDictionary: SnapshotType[],
  root: CompactSnapshotInstance,
];

export type ParsedSnapshotSerialization = SerializedSnapshotInstance | CompactSnapshotSerialization;

const EMPTY_COMPACT_SNAPSHOT_CHILDREN: CompactSnapshotInstance[] = [];

interface SnapshotInstanceLike {
  __id: number;
  type: SnapshotType;
  __values?: unknown[] | undefined;
  __listItemPlatformInfo?: unknown;
  __extraProps?: Record<string, unknown> | undefined;
  __slotIndex: number;
}

interface SnapshotInstanceLinks {
  __firstChild: SnapshotInstanceLike | null;
  __nextSibling: SnapshotInstanceLike | null;
}

function getFirstChild(instance: SnapshotInstanceLike): SnapshotInstanceLike | null {
  return (instance as unknown as SnapshotInstanceLinks).__firstChild;
}

function getNextSibling(instance: SnapshotInstanceLike): SnapshotInstanceLike | null {
  return (instance as unknown as SnapshotInstanceLinks).__nextSibling;
}

function encodeSnapshotInstance(
  instance: SnapshotInstanceLike,
  typeIndexes: Map<SnapshotType, number>,
  typeDictionary: SnapshotType[],
): CompactSnapshotInstance {
  const type = instance.type;
  let typeIndex = typeIndexes.get(type);
  if (typeIndex === undefined) {
    typeIndex = typeDictionary.length;
    typeIndexes.set(type, typeIndex);
    typeDictionary.push(type);
  }

  const encoded: CompactSnapshotInstance = [instance.__id, typeIndex, 0];
  if (instance.__values !== undefined) {
    encoded[2] |= SnapshotField.values;
    encoded.push(instance.__values);
  }
  if (instance.__listItemPlatformInfo) {
    encoded[2] |= SnapshotField.listItemPlatformInfo;
    encoded.push(instance.__listItemPlatformInfo);
  }
  if (instance.__extraProps !== undefined) {
    encoded[2] |= SnapshotField.extraProps;
    encoded.push(instance.__extraProps);
  }
  let child = getFirstChild(instance);
  if (child) {
    encoded[2] |= SnapshotField.children;
    const children: CompactSnapshotInstance[] = [];
    encoded.push(children);
    while (child) {
      children.push(encodeSnapshotInstance(child, typeIndexes, typeDictionary));
      child = getNextSibling(child);
    }
  }
  if (instance.__slotIndex > 0) {
    encoded[2] |= SnapshotField.slotIndex;
    encoded.push(instance.__slotIndex);
  }

  return encoded;
}

export function stringifyCompactSnapshot(instance: SnapshotInstanceLike): string {
  const typeDictionary: SnapshotType[] = [];
  const root = encodeSnapshotInstance(instance, new Map(), typeDictionary);
  const serialization: CompactSnapshotSerialization = [
    COMPACT_SNAPSHOT_VERSION,
    typeDictionary,
    root,
  ];
  return JSON.stringify(serialization);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function assertCompactSnapshotInstance(
  value: unknown,
  typeDictionary: SnapshotType[],
): asserts value is CompactSnapshotInstance {
  if (!isUnknownArray(value) || value.length < 3) {
    throw new Error('Invalid compact first-screen snapshot node.');
  }

  const id = value[0];
  const typeIndex = value[1];
  const fieldMask = value[2];
  if (!Number.isInteger(id)) {
    throw new Error('Invalid compact first-screen snapshot id.');
  }
  if (
    !Number.isInteger(typeIndex)
    || (typeIndex as number) < 0
    || (typeIndex as number) >= typeDictionary.length
  ) {
    throw new Error('Invalid compact first-screen snapshot type index.');
  }
  if (
    !Number.isInteger(fieldMask)
    || (fieldMask as number) < 0
    || (fieldMask as number) > ALL_SNAPSHOT_FIELDS
    || ((fieldMask as number) & ~ALL_SNAPSHOT_FIELDS) !== 0
  ) {
    throw new Error('Invalid compact first-screen snapshot field mask.');
  }

  let fieldIndex = 3;
  if (
    (fieldMask as number) & SnapshotField.values
    && !isUnknownArray(value[fieldIndex++])
  ) {
    throw new Error('Invalid compact first-screen snapshot values.');
  }
  if ((fieldMask as number) & SnapshotField.listItemPlatformInfo) {
    fieldIndex++;
  }
  if (
    (fieldMask as number) & SnapshotField.extraProps
    && !isRecord(value[fieldIndex++])
  ) {
    throw new Error('Invalid compact first-screen snapshot extra props.');
  }
  if (
    (fieldMask as number) & SnapshotField.children
    && !isUnknownArray(value[fieldIndex++])
  ) {
    throw new Error('Invalid compact first-screen snapshot children.');
  }
  if ((fieldMask as number) & SnapshotField.slotIndex) {
    const slotIndex: unknown = value[fieldIndex++];
    if (!Number.isInteger(slotIndex) || (slotIndex as number) <= 0) {
      throw new Error('Invalid compact first-screen snapshot slot index.');
    }
  }
  if (fieldIndex !== value.length) {
    throw new Error('Invalid compact first-screen snapshot field count.');
  }
}

export function validateCompactSnapshotSerialization(
  serialization: CompactSnapshotSerialization,
): void {
  const typeDictionary = serialization[1];
  const validateNode = (node: unknown): void => {
    assertCompactSnapshotInstance(node, typeDictionary);
    for (const child of getCompactSnapshotChildren(node)) {
      validateNode(child);
    }
  };
  validateNode(serialization[2]);
}

function assertLegacySnapshotInstance(value: unknown): asserts value is SerializedSnapshotInstance {
  if (
    !isRecord(value)
    || !Number.isInteger(value['id'])
    || (typeof value['type'] !== 'string' && value['type'] !== null)
  ) {
    throw new Error('Invalid legacy first-screen snapshot root.');
  }
}

export function parseSnapshotSerialization(serialized: string): ParsedSnapshotSerialization {
  const parsed: unknown = JSON.parse(serialized);
  if (!isUnknownArray(parsed)) {
    assertLegacySnapshotInstance(parsed);
    return parsed;
  }

  const version: unknown = parsed[0];
  if (version !== COMPACT_SNAPSHOT_VERSION) {
    throw new Error(`Unsupported compact first-screen snapshot version: ${String(version)}.`);
  }
  if (parsed.length !== 3) {
    throw new Error('Invalid compact first-screen snapshot envelope.');
  }

  const typeDictionary: unknown = parsed[1];
  if (
    !isUnknownArray(typeDictionary)
    || typeDictionary.some(type => typeof type !== 'string' && type !== null)
  ) {
    throw new Error('Invalid compact first-screen snapshot type dictionary.');
  }
  if (!isUnknownArray(parsed[2])) {
    throw new Error('Invalid compact first-screen snapshot root.');
  }
  const serialization = parsed as CompactSnapshotSerialization;
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    validateCompactSnapshotSerialization(serialization);
  }
  return serialization;
}

export function isCompactSnapshotSerialization(
  value: ParsedSnapshotSerialization,
): value is CompactSnapshotSerialization {
  return Array.isArray(value);
}

function compactFieldIndex(node: CompactSnapshotInstance, field: number): number {
  const fieldMask = node[2];
  if (!(fieldMask & field)) {
    return -1;
  }

  return 3 + FIELD_COUNT_BY_MASK[fieldMask & (field - 1)]!;
}

export function getCompactSnapshotValues(node: CompactSnapshotInstance): unknown[] | undefined {
  const index = compactFieldIndex(node, SnapshotField.values);
  return index === -1 ? undefined : node[index] as unknown[];
}

export function getCompactSnapshotListItemPlatformInfo(
  node: CompactSnapshotInstance,
): unknown {
  const index = compactFieldIndex(node, SnapshotField.listItemPlatformInfo);
  return index === -1 ? undefined : node[index];
}

export function getCompactSnapshotExtraProps(
  node: CompactSnapshotInstance,
): Record<string, unknown> | undefined {
  const index = compactFieldIndex(node, SnapshotField.extraProps);
  return index === -1 ? undefined : node[index] as Record<string, unknown>;
}

export function getCompactSnapshotChildren(
  node: CompactSnapshotInstance,
): CompactSnapshotInstance[] {
  const index = compactFieldIndex(node, SnapshotField.children);
  return index === -1 ? EMPTY_COMPACT_SNAPSHOT_CHILDREN : node[index] as CompactSnapshotInstance[];
}

export function getCompactSnapshotSlotIndex(node: CompactSnapshotInstance): number {
  const index = compactFieldIndex(node, SnapshotField.slotIndex);
  return index === -1 ? 0 : node[index] as number;
}
