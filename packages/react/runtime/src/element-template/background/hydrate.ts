// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { globalCommitContext, markRemovedSubtreeForPostDispatchTeardown } from './commit-context.js';
import {
  BUILTIN_RAW_TEXT_TEMPLATE_KEY,
  BackgroundListElementTemplateInstance,
  toUpdateTypedListItemCommand,
} from './instance.js';
import type { BackgroundElementTemplateInstance } from './instance.js';
import { backgroundElementTemplateInstanceManager } from './manager.js';
import { isDirectOrDeepEqual } from '../../utils.js';
import { hydrationMap } from '../hydration-map.js';
import { ElementTemplateUpdateOps } from '../protocol/opcodes.js';
import { elementTemplateIdentityKey } from '../protocol/template-type.js';
import type {
  SerializableValue,
  SerializedCompiledNode,
  SerializedEtNode,
  SerializedTypedNode,
} from '../protocol/types.js';
import { __etAttrPlanMap, adaptMTEventAttrSlot } from '../runtime/template/attr-slot-plan.js';
import { isMTEventNativeWrapper } from '../runtime/template/main-thread-event-ctx.js';

const MAIN_BUNDLE_URL_SENTINEL = '__Card__';
const PAGE_ROOT_TARGET_HANDLE_ID = 0;
const PAGE_ROOT_SLOT_ID = 0;
const COMPONENT_AT_INDEX_ATTR = 'component-at-index';
const COMPONENT_AT_INDEXES_ATTR = 'component-at-indexes';
const ENQUEUE_COMPONENT_ATTR = 'enqueue-component';
const UPDATE_LIST_INFO_ATTR = 'update-list-info';

type SerializedTypedListNode = SerializedTypedNode & { tag: 'list' };

export function hydrateRootChildrenIntoContext(
  serializedChildren: SerializedEtNode[],
  root: BackgroundElementTemplateInstance,
): boolean {
  return hydrateChildListIntoContext(
    PAGE_ROOT_TARGET_HANDLE_ID,
    PAGE_ROOT_SLOT_ID,
    serializedChildren,
    root.childNodes,
  );
}

function isSerializedCompiledNode(serialized: SerializedEtNode): serialized is SerializedCompiledNode {
  return typeof (serialized as { templateKey?: unknown }).templateKey === 'string';
}

interface HydrateChildListDiff {
  hasChanges: boolean;
  // Background child at a new slot index that has no matching serialized child.
  insertions: Record<number, BackgroundElementTemplateInstance>;
  insertionCount: number;
  // Serialized child indexes that no longer exist in the background slot.
  removals: number[];
  // Serialized child old index -> same-slot reorder target.
  moves: Record<number, { toIndex: number; instance: BackgroundElementTemplateInstance }>;
}

function hydrateMatchingChildrenAndDiffSlot(
  serializedChildren: SerializedEtNode[],
  backgroundChildren: BackgroundElementTemplateInstance[],
): HydrateChildListDiff | null {
  let lastPlacedIndex = 0;
  const result: HydrateChildListDiff = {
    hasChanges: false,
    insertions: {},
    insertionCount: 0,
    removals: [],
    moves: {},
  };
  const serializedByNodeKey: Record<string, [SerializedEtNode, number][]> = {};
  const serializedCursorByNodeKey: Record<string, number> = {};

  for (let i = 0; i < serializedChildren.length; i += 1) {
    const node = serializedChildren[i]!;
    const key = getSerializedNodeHydrateKey(node);
    (serializedByNodeKey[key] ??= []).push([node, i]);
  }

  for (let i = 0; i < backgroundChildren.length; i += 1) {
    const backgroundChild = backgroundChildren[i]!;
    const backgroundKey = backgroundChild.type;
    const serializedCandidates = serializedByNodeKey[backgroundKey];
    const candidateCursor = serializedCursorByNodeKey[backgroundKey] ?? 0;
    const matchedSerialized = serializedCandidates?.[candidateCursor];

    if (matchedSerialized) {
      serializedCursorByNodeKey[backgroundKey] = candidateCursor + 1;
      const oldIndex = matchedSerialized[1];
      if (!hydrateInstance(matchedSerialized[0], backgroundChild)) {
        return null;
      }
      if (oldIndex < lastPlacedIndex) {
        result.moves[oldIndex] = { toIndex: i, instance: backgroundChild };
        result.hasChanges = true;
      } else {
        lastPlacedIndex = oldIndex;
      }
    } else {
      result.insertions[i] = backgroundChild;
      result.insertionCount += 1;
      result.hasChanges = true;
    }
  }

  for (const key in serializedByNodeKey) {
    const candidates = serializedByNodeKey[key]!;
    const candidateCursor = serializedCursorByNodeKey[key] ?? 0;
    for (let i = candidateCursor; i < candidates.length; i += 1) {
      result.removals.push(candidates[i]![1]);
      result.hasChanges = true;
    }
  }

  return result;
}

function hydrateInstance(
  serialized: SerializedEtNode,
  instance: BackgroundElementTemplateInstance,
): boolean {
  if (isSerializedCompiledNode(serialized)) {
    return hydrateCompiledInstance(serialized, instance);
  }
  if (__DEV__ && serialized.tag !== 'list') {
    lynx.reportError(
      new Error(`ElementTemplate hydrate does not support serialized typed node '${serialized.tag}'.`),
    );
    return false;
  }
  return hydrateListInstance(
    serialized as SerializedTypedListNode,
    instance as BackgroundListElementTemplateInstance,
  );
}

function hydrateCompiledInstance(
  serialized: SerializedCompiledNode,
  instance: BackgroundElementTemplateInstance,
): boolean {
  const handleId = serialized.uid as number;
  if (!bindHydrationHandleId(instance, handleId, serialized.templateKey)) {
    return false;
  }
  instance.prepareAttributeSlotsForHydration();
  hydrateAttributeSlots(instance.type, handleId, serialized.attributeSlots ?? [], instance.attributeSlots);

  if (serialized.templateKey === BUILTIN_RAW_TEXT_TEMPLATE_KEY) {
    return true;
  }

  const serializedElementSlots = serialized.elementSlots ?? [];
  const backgroundElementSlots = instance.elementSlots;
  // Snapshot hydrates dynamic children through slot-filtered lists. Keeping ET
  // scoped the same way means a cross-slot candidate is a source remove plus a
  // target create/insert, while same-slot reorder can still stay move-like.
  const slotCount = Math.max(serializedElementSlots.length, backgroundElementSlots.length);
  for (let slotId = 0; slotId < slotCount; slotId += 1) {
    const serializedSlot = serializedElementSlots[slotId];
    const backgroundSlot = backgroundElementSlots[slotId];
    if (!serializedSlot && !backgroundSlot) {
      continue;
    }
    if (
      !hydrateChildListIntoContext(
        instance.instanceId,
        slotId,
        serializedSlot ?? [],
        backgroundSlot ?? [],
      )
    ) {
      return false;
    }
  }
  return true;
}

function getSerializedNodeHydrateKey(serialized: SerializedEtNode): string {
  if (!isSerializedCompiledNode(serialized)) {
    return serialized.tag;
  }
  return elementTemplateIdentityKey(
    serialized.templateKey,
    normalizeSerializedBundleUrl(serialized.bundleUrl),
  );
}

function normalizeSerializedBundleUrl(bundleUrl: string | undefined): string | null {
  return bundleUrl === undefined || bundleUrl === MAIN_BUNDLE_URL_SENTINEL ? null : bundleUrl;
}

function getSerializedTypedListChildren(serialized: SerializedTypedListNode): SerializedEtNode[] {
  return (__DEV__ ? serialized.options?.['listChildren'] : serialized.options!['listChildren']) as SerializedEtNode[];
}

function hydrateListInstance(
  serialized: SerializedTypedListNode,
  instance: BackgroundListElementTemplateInstance,
): boolean {
  if (__DEV__ && (serialized.elementSlots?.length ?? 0) > 0) {
    lynx.reportError(new Error('ElementTemplate hydrate typed list does not support elementSlots.'));
    return false;
  }

  const listChildren = getSerializedTypedListChildren(serialized);
  if (__DEV__ && !Array.isArray(listChildren)) {
    lynx.reportError(new Error('ElementTemplate hydrate typed list requires options.listChildren.'));
    return false;
  }

  const backgroundChildren = instance.childNodes;
  const handleId = serialized.uid as number;
  if (!bindHydrationHandleId(instance, handleId, serialized.tag)) {
    return false;
  }
  instance.prepareAttributeSlotsForHydration();
  hydrateAttributeSlots(
    serialized.tag,
    handleId,
    [getStableSerializedListAttributes(serialized.attributes)],
    instance.attributeSlots,
  );

  const listDiff = hydrateMatchingChildrenAndDiffSlot(listChildren, backgroundChildren);
  if (listDiff === null) {
    return false;
  }

  return emitHydrateTypedListReconciliation(
    instance,
    listChildren,
    backgroundChildren,
    listDiff,
  );
}

function getStableSerializedListAttributes(
  attributes: SerializedTypedNode['attributes'],
): SerializableValue {
  if (attributes == null) {
    return null;
  }
  if (
    !(COMPONENT_AT_INDEX_ATTR in attributes)
    && !(COMPONENT_AT_INDEXES_ATTR in attributes)
    && !(ENQUEUE_COMPONENT_ATTR in attributes)
    && !(UPDATE_LIST_INFO_ATTR in attributes)
  ) {
    return attributes;
  }
  const stableAttributes: Record<string, SerializableValue> = {};
  let hasStableAttribute = false;
  for (const key in attributes) {
    if (
      key === COMPONENT_AT_INDEX_ATTR
      || key === COMPONENT_AT_INDEXES_ATTR
      || key === ENQUEUE_COMPONENT_ATTR
      || key === UPDATE_LIST_INFO_ATTR
    ) {
      continue;
    }
    stableAttributes[key] = attributes[key]!;
    hasStableAttribute = true;
  }
  return hasStableAttribute ? stableAttributes : null;
}

function hydrateChildListIntoContext(
  targetHandleId: number,
  slotId: number,
  serializedChildren: SerializedEtNode[],
  backgroundChildren: BackgroundElementTemplateInstance[],
): boolean {
  if (backgroundChildren.length === 0) {
    for (const serialized of serializedChildren) {
      if (!emitSerializedSubtreeRemove(targetHandleId, slotId, serialized)) {
        return false;
      }
    }
    return true;
  }

  const listDiff = hydrateMatchingChildrenAndDiffSlot(serializedChildren, backgroundChildren);
  if (listDiff === null) {
    return false;
  }

  if (!listDiff.hasChanges) {
    return true;
  }

  // Hydrate emits patches directly here. Replaying against serialized order
  // keeps insert targets in the main-thread slot without reshaping background.
  const removalIndexes = new Set(listDiff.removals);
  const { insertions, moves } = listDiff;
  const movesWaitingForInsertionPoint = new Map<number, BackgroundElementTemplateInstance>();
  let serializedCursor = 0;
  let currentSerializedChild = serializedChildren[serializedCursor];
  let newIndex = 0;
  let oldIndex = 0;
  // Insertions are known before replay starts. Moves are counted only when their
  // old serialized position is reached, so the cursor can keep emitting patches
  // even after all serialized children have been consumed.
  let insertOrMovePatchesWaitingForInsertionPoint = listDiff.insertionCount;
  while (currentSerializedChild || insertOrMovePatchesWaitingForInsertionPoint > 0) {
    let keepCurrentSerializedChild = false;
    if (currentSerializedChild && removalIndexes.has(oldIndex)) {
      if (!emitSerializedSubtreeRemove(targetHandleId, slotId, currentSerializedChild)) {
        return false;
      }
    } else if (currentSerializedChild && moves[oldIndex] !== undefined) {
      const move = moves[oldIndex]!;
      movesWaitingForInsertionPoint.set(move.toIndex, move.instance);
      insertOrMovePatchesWaitingForInsertionPoint += 1;
    } else {
      const beforeChildId = currentSerializedChild ? currentSerializedChild.uid as number : 0;
      const movedChild = movesWaitingForInsertionPoint.get(newIndex);
      if (movedChild) {
        keepCurrentSerializedChild = true;
        globalCommitContext.ops.push(
          ElementTemplateUpdateOps.insertNode,
          targetHandleId,
          slotId,
          movedChild.instanceId,
          beforeChildId,
        );
        insertOrMovePatchesWaitingForInsertionPoint -= 1;
      } else if (insertions[newIndex] !== undefined) {
        const insertedChild = insertions[newIndex]!;
        keepCurrentSerializedChild = true;
        emitCreateSubtree(insertedChild);
        globalCommitContext.ops.push(
          ElementTemplateUpdateOps.insertNode,
          targetHandleId,
          slotId,
          insertedChild.instanceId,
          beforeChildId,
        );
        insertOrMovePatchesWaitingForInsertionPoint -= 1;
      }

      newIndex += 1;
    }
    if (currentSerializedChild && !keepCurrentSerializedChild) {
      currentSerializedChild = serializedChildren[++serializedCursor];
      oldIndex += 1;
    }
  }
  return true;
}

function emitSerializedSubtreeRemove(
  targetHandleId: number,
  slotId: number,
  serialized: SerializedEtNode,
): boolean {
  // The removed child may no longer have a live background instance in this
  // slot, so serialized data is the source of truth for registry cleanup.
  const removedSubtreeHandleIds: number[] = [];
  if (!collectRemovableSerializedSubtreeHandleIdsInto(serialized, removedSubtreeHandleIds)) {
    return false;
  }
  const childId = removedSubtreeHandleIds[0]!;
  const existing = backgroundElementTemplateInstanceManager.get(childId);
  globalCommitContext.ops.push(
    ElementTemplateUpdateOps.removeNode,
    targetHandleId,
    slotId,
    childId,
    removedSubtreeHandleIds,
  );
  if (existing && !existing.parent) {
    markRemovedSubtreeForPostDispatchTeardown(existing);
  }
  return true;
}

function collectRemovableSerializedSubtreeHandleIdsInto(
  serialized: SerializedEtNode,
  handles: number[],
): boolean {
  const handleId = getRemovableSerializedHandleId(serialized);
  if (handleId === null) {
    return false;
  }
  handles.push(handleId);

  if (isSerializedCompiledNode(serialized)) {
    for (const slotChildren of serialized.elementSlots ?? []) {
      if (!slotChildren) {
        continue;
      }
      for (const child of slotChildren) {
        if (!collectRemovableSerializedSubtreeHandleIdsInto(child, handles)) {
          return false;
        }
      }
    }
    return true;
  }

  if (__DEV__ && serialized.tag !== 'list') {
    lynx.reportError(
      new Error(`ElementTemplate hydrate does not support serialized typed node '${serialized.tag}'.`),
    );
    return false;
  }
  if (__DEV__ && (serialized.elementSlots?.length ?? 0) > 0) {
    lynx.reportError(new Error('ElementTemplate hydrate typed list does not support elementSlots.'));
    return false;
  }
  const listChildren = getSerializedTypedListChildren(serialized as SerializedTypedListNode);
  if (__DEV__ && !Array.isArray(listChildren)) {
    lynx.reportError(new Error('ElementTemplate hydrate typed list requires options.listChildren.'));
    return false;
  }
  for (const child of listChildren) {
    if (!collectRemovableSerializedSubtreeHandleIdsInto(child, handles)) {
      return false;
    }
  }
  return true;
}

function getRemovableSerializedHandleId(serialized: SerializedEtNode): number | null {
  const handleId = serialized.uid as number;
  if (__DEV__ && (typeof handleId !== 'number' || !Number.isInteger(handleId) || handleId === 0)) {
    lynx.reportError(
      new Error(`ElementTemplate hydrate remove received invalid uid ${String(handleId)}.`),
    );
    return null;
  }
  return handleId;
}

function emitHydrateTypedListReconciliation(
  instance: BackgroundListElementTemplateInstance,
  serializedChildren: SerializedEtNode[],
  backgroundChildren: BackgroundElementTemplateInstance[],
  listDiff: HydrateChildListDiff,
): boolean {
  const movedOldIndexes = Object.keys(listDiff.moves).map(Number);
  const removalIndexes = listDiff.removals.concat(movedOldIndexes).sort((a, b) => a - b);
  for (let index = 0; index < removalIndexes.length; index += 1) {
    const oldIndex = removalIndexes[index]!;
    const serialized = serializedChildren[oldIndex]!;
    let itemId: number;
    const removedSubtreeHandleIds: number[] = [];
    if (listDiff.moves[oldIndex] === undefined) {
      if (!collectRemovableSerializedSubtreeHandleIdsInto(serialized, removedSubtreeHandleIds)) {
        return false;
      }
      itemId = removedSubtreeHandleIds[0]!;
    } else {
      itemId = serialized.uid as number;
    }
    globalCommitContext.ops.push(
      ElementTemplateUpdateOps.removeTypedListItem,
      instance.instanceId,
      itemId,
      removedSubtreeHandleIds,
    );
  }

  const insertedIndexes = Object.keys(listDiff.insertions).map(Number);
  let movedToIndexes: Set<number> | null = null;
  for (let index = 0; index < movedOldIndexes.length; index += 1) {
    const toIndex = listDiff.moves[movedOldIndexes[index]!]!.toIndex;
    insertedIndexes.push(toIndex);
    (movedToIndexes ??= new Set()).add(toIndex);
  }
  insertedIndexes.sort((a, b) => b - a);
  for (let index = 0; index < insertedIndexes.length; index += 1) {
    const insertedIndex = insertedIndexes[index]!;
    const child = backgroundChildren[insertedIndex]!;
    if (listDiff.insertions[insertedIndex]) {
      emitCreateSubtree(child);
    }
    globalCommitContext.ops.push(
      ElementTemplateUpdateOps.insertTypedListItem,
      instance.instanceId,
      toUpdateTypedListItemCommand(child),
      backgroundChildren[insertedIndex + 1]?.instanceId ?? 0,
    );
  }

  for (let index = 0; index < backgroundChildren.length; index += 1) {
    if (listDiff.insertions[index] || movedToIndexes?.has(index)) {
      continue;
    }
    globalCommitContext.ops.push(
      ElementTemplateUpdateOps.updateTypedListItem,
      instance.instanceId,
      toUpdateTypedListItemCommand(backgroundChildren[index]!),
    );
  }
  return true;
}

function emitCreateSubtree(node: BackgroundElementTemplateInstance): void {
  // Linked-list walk: slot grouping would be discarded since we recurse into
  // every child regardless of slot. `emitCreate` does its own single-walk
  // serialization of `instanceId`s grouped by slot.
  let child = node.firstChild;
  while (child) {
    emitCreateSubtree(child);
    child = child.nextSibling;
  }
  node.prepareAttributeSlotsForHydration();
  node.emitCreate();
}

function bindHydrationHandleId(
  instance: BackgroundElementTemplateInstance,
  handleId: number,
  templateKey: string,
): boolean {
  const oldHandleId = instance.instanceId;
  if (__DEV__) {
    try {
      backgroundElementTemplateInstanceManager.updateId(instance.instanceId, handleId);
      // Ref proxies created before hydrate keep the old background id; resolve it
      // lazily so user-held proxies continue selecting the hydrated native node.
      hydrationMap.set(oldHandleId, handleId);
      instance.markMaterializedByHydration();
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      lynx.reportError(
        new Error(`ElementTemplate hydrate received invalid uid ${handleId} for '${templateKey}': ${reason}`),
      );
      return false;
    }
  }

  backgroundElementTemplateInstanceManager.updateId(instance.instanceId, handleId);
  hydrationMap.set(oldHandleId, handleId);
  instance.markMaterializedByHydration();
  return true;
}

function hydrateAttributeSlots(
  templateType: string,
  handleId: number,
  beforeSlots: SerializableValue[],
  afterSlots: SerializableValue[],
): void {
  const slotCount = Math.max(beforeSlots.length, afterSlots.length);
  for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
    const beforeValue = beforeSlots[slotIndex];
    const afterValue = afterSlots[slotIndex];
    if (
      isDirectOrDeepEqual(beforeValue, afterValue)
      && !shouldForceMTEventHydrateSlot(templateType, slotIndex, afterValue)
    ) {
      continue;
    }
    if (afterValue === undefined && beforeValue === null) {
      // JSON serialization turns undefined array slots into null on the main-thread payload.
      continue;
    }
    globalCommitContext.ops.push(
      ElementTemplateUpdateOps.setAttribute,
      handleId,
      slotIndex,
      afterValue ?? null,
    );
  }
}

function shouldForceMTEventHydrateSlot(
  templateType: string,
  attrSlotIndex: number,
  value: SerializableValue | undefined,
): boolean {
  if (!isMTEventNativeWrapper(value)) {
    return false;
  }
  const attrPlan = __etAttrPlanMap[templateType];
  if (!attrPlan) {
    return false;
  }
  for (let planIndex = 0; planIndex < attrPlan.length; planIndex += 2) {
    if (
      attrPlan[planIndex] === attrSlotIndex
      && attrPlan[planIndex + 1] === adaptMTEventAttrSlot
    ) {
      return true;
    }
  }
  return false;
}
