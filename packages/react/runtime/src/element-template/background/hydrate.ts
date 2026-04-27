// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { GlobalCommitContext, resetGlobalCommitContext } from './commit-context.js';
import {
  BUILTIN_RAW_TEXT_TEMPLATE_KEY,
  BackgroundElementTemplateInstance,
  BackgroundElementTemplateSlot,
} from './instance.js';
import { backgroundElementTemplateInstanceManager } from './manager.js';
import { isDirectOrDeepEqual } from '../../utils.js';
import { ElementTemplateUpdateOps } from '../protocol/opcodes.js';
import type {
  ElementTemplateUpdateCommandStream,
  SerializableValue,
  SerializedElementTemplate,
} from '../protocol/types.js';

function isRawTextTemplateKey(type: string): boolean {
  return type === BUILTIN_RAW_TEXT_TEMPLATE_KEY;
}

export function hydrate(
  before: SerializedElementTemplate,
  after: BackgroundElementTemplateInstance,
): ElementTemplateUpdateCommandStream {
  resetGlobalCommitContext();
  hydrateIntoContext(before, after);
  return GlobalCommitContext.ops;
}

export function hydrateIntoContext(
  before: SerializedElementTemplate,
  after: BackgroundElementTemplateInstance,
  created?: Set<number>,
): void {
  hydrateImpl(before, after, created ?? new Set<number>());
}

interface DiffResult<K> {
  $$diff: true;
  i: Record<number, K>;
  r: number[];
  m: Record<number, number>;
}

function diffArrayAction<T, K>(
  before: T[],
  diffResult: DiffResult<K>,
  onInsert: (node: K, target: T | undefined) => T,
  onRemove: (node: T) => void,
  onMove: (node: T, target: T | undefined) => void,
): T[] {
  const deleteSet = new Set(diffResult.r);
  const { i: insertMap, m: placementMap } = diffResult;
  const moveTempMap = new Map<number, T>();
  let old: T | undefined;
  let k = 0;
  old = before[k];
  const result: T[] = [];
  let i = 0;
  let j = 0;
  let remain = Object.keys(insertMap).length;
  while (old || remain > 0) {
    let keep = false;
    if (old && deleteSet.has(j)) {
      onRemove(old);
    } else if (old && placementMap[j] !== undefined) {
      moveTempMap.set(placementMap[j]!, old);
      remain += 1;
    } else {
      let newNode = old;
      if (moveTempMap.has(i)) {
        newNode = moveTempMap.get(i)!;
        keep = true;
        onMove(newNode, old);
        remain -= 1;
      } else if (insertMap[i] !== undefined) {
        newNode = onInsert(insertMap[i]!, old);
        keep = true;
        remain -= 1;
      }

      result.push(newNode!);
      i += 1;
    }
    if (old && !keep) {
      old = before[++k];
      j += 1;
    }
  }

  return result;
}

function hydrateImpl(
  before: SerializedElementTemplate,
  after: BackgroundElementTemplateInstance,
  created: Set<number>,
): void {
  if (before.templateKey !== after.type && __DEV__) {
    lynx.reportError(
      new Error(
        `ElementTemplate hydrate key mismatch: main='${before.templateKey}' background='${after.type}'.`,
      ),
    );
    return;
  }

  const handleId = getSerializedHandleId(before);
  if (handleId == null) {
    if (__DEV__) {
      lynx.reportError(
        new Error(`ElementTemplate hydrate missing uid for '${before.templateKey}'.`),
      );
    }
    return;
  }

  if (!bindHydrationHandleId(after, handleId, before.templateKey)) {
    return;
  }
  syncAttributeSlots(handleId, getSerializedAttributeSlots(before), after.attributeSlots);

  if (isRawTextTemplateKey(before.templateKey)) {
    return;
  }

  const beforeElementSlots = getSerializedElementSlots(before);
  const slotIds = new Set<number>();
  for (let slotId = 0; slotId < beforeElementSlots.length; slotId += 1) {
    if (!beforeElementSlots[slotId]) {
      continue;
    }
    slotIds.add(slotId);
  }

  for (const slotId of slotIds) {
    syncSlotChildren(after, slotId, getSerializedTemplateChildren(beforeElementSlots[slotId]), created);
  }

  for (let slotId = 0; slotId < after.elementSlots.length; slotId += 1) {
    if (!after.elementSlots[slotId]) {
      continue;
    }
    if (slotIds.has(slotId)) {
      continue;
    }
    syncSlotChildren(after, slotId, [], created);
  }
}

function syncSlotChildren(
  parent: BackgroundElementTemplateInstance,
  slotId: number,
  beforeChildren: SerializedElementTemplate[],
  created: Set<number>,
): void {
  if (__DEV__ && !validateTemplateChildrenHandles(parent, slotId, beforeChildren)) {
    return;
  }

  const slot = ensureSlot(parent, slotId);

  const afterChildren = parent.elementSlots[slotId]!;

  const beforeMap: Record<string, Array<[SerializedElementTemplate, number]>> = {};
  for (let i = 0; i < beforeChildren.length; i += 1) {
    const node = beforeChildren[i]!;
    const key = getSerializedInstanceKey(node);
    (beforeMap[key] ??= []).push([node, i]);
  }

  const diffResult: DiffResult<BackgroundElementTemplateInstance> = {
    $$diff: true,
    i: {},
    r: [],
    m: {},
  };

  let lastPlacedIndex = 0;
  for (let i = 0; i < afterChildren.length; i += 1) {
    const afterNode = afterChildren[i]!;
    const key = getBackgroundInstanceKey(afterNode);
    const beforeNodes = beforeMap[key];
    let beforeNode: [SerializedElementTemplate, number] | undefined;

    if (beforeNodes && beforeNodes.length) {
      beforeNode = beforeNodes.shift();
    }

    if (beforeNode) {
      const [beforeInstance, oldIndex] = beforeNode;
      hydrateImpl(beforeInstance, afterNode, created);
      if (oldIndex < lastPlacedIndex) {
        diffResult.m[oldIndex] = i;
      } else {
        lastPlacedIndex = oldIndex;
      }
    } else {
      diffResult.i[i] = afterNode;
    }
  }

  for (const key in beforeMap) {
    for (const [, index] of beforeMap[key]!) {
      diffResult.r.push(index);
    }
  }

  if (isEmptyDiffResult(diffResult)) {
    return;
  }

  const mainOrder: BackgroundElementTemplateInstance[] = [];
  for (const serialized of beforeChildren) {
    const handleId = getSerializedHandleId(serialized);
    const reused = handleId == null
      ? undefined
      : backgroundElementTemplateInstanceManager.get(handleId);
    mainOrder.push(reused ?? createPlaceholder(serialized));
  }

  replaceChildren(slot, mainOrder);

  diffArrayAction(
    beforeChildren,
    diffResult,
    (node, target) => {
      const beforeHandleId = getSerializedHandleId(target);
      const beforeChild = beforeHandleId == null
        ? null
        : backgroundElementTemplateInstanceManager.get(beforeHandleId)!;
      emitCreateRecursive(node, created);
      slot.insertBefore(node, beforeChild);
      return (target ?? node) as unknown as SerializedElementTemplate;
    },
    (node) => {
      const childId = getSerializedHandleId(node);
      if (childId == null) {
        return;
      }
      const child = backgroundElementTemplateInstanceManager.get(childId);
      if (child && child.parent === slot) {
        slot.removeChild(child);
      }
    },
    (node, target) => {
      const childId = getSerializedHandleId(node);
      if (childId == null) {
        return;
      }
      const child = backgroundElementTemplateInstanceManager.get(childId);
      const beforeHandleId = getSerializedHandleId(target);
      const beforeChild = beforeHandleId == null
        ? null
        : backgroundElementTemplateInstanceManager.get(beforeHandleId)!;
      if (child && child.parent === slot) {
        slot.insertBefore(child, beforeChild);
      }
    },
  );
}

function emitCreateRecursive(node: BackgroundElementTemplateInstance, created: Set<number>): void {
  if (created.has(node.instanceId)) {
    return;
  }
  for (const slotChildren of node.elementSlots) {
    /* v8 ignore start */
    if (!slotChildren) {
      continue;
    }
    /* v8 ignore stop */
    for (const child of slotChildren) {
      emitCreateRecursive(child, created);
    }
  }
  created.add(node.instanceId);
  node.emitCreate();
}

function ensureSlot(
  parent: BackgroundElementTemplateInstance,
  slotId: number,
): BackgroundElementTemplateSlot {
  parent.elementSlots[slotId] ??= [];
  let child = parent.firstChild;
  while (child) {
    if (child instanceof BackgroundElementTemplateSlot && child.partId === slotId) {
      return child;
    }
    child = child.nextSibling;
  }

  const slot = new BackgroundElementTemplateSlot();
  slot.setAttribute('id', slotId);
  parent.appendChild(slot);
  return slot;
}

function replaceChildren(
  parent: BackgroundElementTemplateInstance,
  children: BackgroundElementTemplateInstance[],
): void {
  let child = parent.firstChild;
  while (child) {
    const next = child.nextSibling;
    child.parent = null;
    child.nextSibling = null;
    child.previousSibling = null;
    child = next;
  }

  parent.firstChild = null;
  parent.lastChild = null;

  let prev: BackgroundElementTemplateInstance | null = null;
  for (const c of children) {
    c.parent = parent;
    c.previousSibling = prev;
    c.nextSibling = null;
    if (prev) {
      prev.nextSibling = c;
    } else {
      parent.firstChild = c;
    }
    prev = c;
    parent.lastChild = c;
  }

  if (parent instanceof BackgroundElementTemplateSlot) {
    const host = parent.parent;
    if (host && parent.partId >= 0) {
      host.elementSlots[parent.partId] = [...children];
    }
  }
}

function createPlaceholder(serialized: SerializedElementTemplate): BackgroundElementTemplateInstance {
  const handleId = getSerializedHandleId(serialized);
  const type = serialized.templateKey;
  let node: BackgroundElementTemplateInstance;
  if (isRawTextTemplateKey(type)) {
    const text = getSerializedRawText(serialized);
    node = new BackgroundElementTemplateInstance(
      BUILTIN_RAW_TEXT_TEMPLATE_KEY,
      [text],
    );
  } else {
    node = new BackgroundElementTemplateInstance(type);
    node.attributeSlots = [...getSerializedAttributeSlots(serialized)];
  }
  if (handleId != null) {
    bindHydrationHandleId(node, handleId, serialized.templateKey);
  }
  return node;
}

function isEmptyDiffResult(result: DiffResult<unknown>): boolean {
  return Object.keys(result.i).length === 0
    && result.r.length === 0
    && Object.keys(result.m).length === 0;
}

function getSerializedInstanceKey(instance: SerializedElementTemplate): string {
  return instance.templateKey;
}

function getBackgroundInstanceKey(instance: BackgroundElementTemplateInstance): string {
  return instance.type;
}

function getSerializedTemplateChildren(
  value: SerializedElementTemplate[] | undefined,
): SerializedElementTemplate[] {
  /* v8 ignore next 3 */
  if (!value) {
    return [];
  }
  const children: SerializedElementTemplate[] = [];
  for (const node of value as unknown[]) {
    if (
      typeof node === 'object'
      && node !== null
      && typeof (node as { templateKey?: unknown }).templateKey === 'string'
    ) {
      children.push(node as SerializedElementTemplate);
    }
  }
  return children;
}

function getSerializedAttributeSlots(
  value: SerializedElementTemplate | undefined,
): SerializableValue[] {
  return Array.isArray(value?.attributeSlots) ? value.attributeSlots : [];
}

function getSerializedElementSlots(
  value: SerializedElementTemplate | undefined,
): SerializedElementTemplate[][] {
  return Array.isArray(value?.elementSlots) ? value.elementSlots : [];
}

function getSerializedHandleId(
  value: SerializedElementTemplate | undefined,
): number | undefined {
  const uid = value?.uid;
  return typeof uid === 'number' ? uid : undefined;
}

function isValidHandleId(handleId: number | undefined): handleId is number {
  return Number.isInteger(handleId) && handleId !== 0;
}

function validateTemplateChildrenHandles(
  parent: BackgroundElementTemplateInstance,
  slotId: number,
  beforeChildren: SerializedElementTemplate[],
): boolean {
  for (const child of beforeChildren) {
    const handleId = getSerializedHandleId(child);
    if (isValidHandleId(handleId)) {
      continue;
    }
    lynx.reportError(
      new Error(
        `ElementTemplate hydrate received invalid nested uid ${String(child.uid)} for `
          + `'${child.templateKey}' in slot ${slotId} of '${parent.type}'.`,
      ),
    );
    return false;
  }
  return true;
}

function getSerializedRawText(
  value: SerializedElementTemplate,
): string {
  const text = value.attributeSlots[0];
  if (typeof text === 'string') {
    return text;
  }
  if (typeof text === 'number' || typeof text === 'boolean') {
    return String(text);
  }
  return '';
}

function bindHydrationHandleId(
  instance: BackgroundElementTemplateInstance,
  handleId: number,
  templateKey: string,
): boolean {
  try {
    backgroundElementTemplateInstanceManager.updateId(instance.instanceId, handleId);
    return true;
  } catch (error) {
    if (__DEV__) {
      const reason = error instanceof Error ? error.message : String(error);
      lynx.reportError(
        new Error(`ElementTemplate hydrate received invalid uid ${handleId} for '${templateKey}': ${reason}`),
      );
    }
    return false;
  }
}

function syncAttributeSlots(
  handleId: number,
  beforeSlots: SerializableValue[],
  afterSlots: SerializableValue[],
): void {
  const slotCount = Math.max(beforeSlots.length, afterSlots.length);
  for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
    const beforeValue = beforeSlots[slotIndex];
    const afterValue = afterSlots[slotIndex];
    if (isDirectOrDeepEqual(beforeValue, afterValue)) {
      continue;
    }
    GlobalCommitContext.ops.push(
      ElementTemplateUpdateOps.setAttribute,
      handleId,
      slotIndex,
      normalizeAttributeSlotValue(afterValue),
    );
  }
}

function normalizeAttributeSlotValue(value: SerializableValue | undefined): SerializableValue | null {
  return value === undefined ? null : value;
}
