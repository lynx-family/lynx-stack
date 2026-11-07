// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getAttributeSlotUpdateOp } from './attr-slots.js';
import { globalCommitContext, markRemovedSubtreeForPostDispatchTeardown } from './commit-context.js';
import {
  getSerializedTypedListChildren,
  isSerializedCompiledNode,
  isSerializedTypedListNode,
} from './hydrate-matcher.js';
import type { HydrateChildListDiff } from './hydrate-matcher.js';
import { backgroundElementTemplateInstanceManager } from './manager.js';
import { getContainingListItem } from './shadow-instance.js';
import type { BackgroundElementTemplateInstance } from './shadow-instance.js';
import { collectMainThreadRefSubtreeHandleIds } from './subtree-handles.js';
import { isDirectOrDeepEqual } from '../../core/deep-equal.js';
import { isMainThreadFunction } from '../../core/main-thread-function.js';
import { hydrationMap } from '../hydration-map.js';
import { isGestureSlotValue } from '../prop-adapters/gesture.js';
import { isMainThreadEventPropKey, isSpreadRecord } from '../prop-adapters/spread.js';
import { ElementTemplateUpdateOps } from '../protocol/opcodes.js';
import { ELEMENT_TEMPLATE_PAGE_HANDLE_ID } from '../protocol/page.js';
import type { SerializableValue, SerializedEtNode, SerializedTypedListNode } from '../protocol/types.js';
import { getMainThreadDynamicAttrSlotKinds } from '../runtime/template/attr-slot-plan.js';
import type { MainThreadDynamicAttrKind } from '../runtime/template/attr-slot-plan.js';
import { isMTEventNativeWrapper } from '../runtime/template/main-thread-event-ctx.js';
import type { MTRefNativeWrapper } from '../runtime/template/main-thread-ref-ctx.js';

export function emitHydrateSlotDiffPatches(
  targetHandleId: number,
  slotId: number,
  serializedChildren: SerializedEtNode[],
  listDiff: HydrateChildListDiff,
): boolean {
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
      const beforeChildId = currentSerializedChild ? currentSerializedChild.uid : 0;
      const movedChild = movesWaitingForInsertionPoint.get(newIndex);
      if (movedChild) {
        keepCurrentSerializedChild = true;
        globalCommitContext.ops.push(
          ElementTemplateUpdateOps.insertNode,
          targetHandleId,
          slotId,
          movedChild.instanceId,
          beforeChildId,
          getContainingListItem(movedChild) ? null : collectMainThreadRefSubtreeHandleIds(movedChild),
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
          getContainingListItem(insertedChild) ? null : collectMainThreadRefSubtreeHandleIds(insertedChild),
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

export function emitSerializedSubtreeRemove(
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

export function collectRemovableSerializedSubtreeHandleIdsInto(
  serialized: SerializedEtNode,
  handles: number[],
): boolean {
  const handleId = getRemovableSerializedHandleId(serialized);
  if (handleId === null) {
    return false;
  }
  handles.push(handleId);

  if (isSerializedCompiledNode(serialized)) {
    for (const slotChildren of serialized.childSlots ?? []) {
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

  if (__DEV__ && !isSerializedTypedListNode(serialized)) {
    lynx.reportError(
      new Error(`ElementTemplate hydrate does not support serialized typed node '${serialized.tag}'.`),
    );
    return false;
  }
  const serializedList = serialized as SerializedTypedListNode;
  if (__DEV__ && (serializedList.childSlots?.length ?? 0) > 0) {
    lynx.reportError(new Error('ElementTemplate hydrate typed list does not support childSlots.'));
    return false;
  }
  const listChildren = getSerializedTypedListChildren(serializedList);
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
  const handleId = serialized.uid;
  if (
    __DEV__
    && (typeof handleId !== 'number'
      || !Number.isInteger(handleId)
      || handleId === ELEMENT_TEMPLATE_PAGE_HANDLE_ID)
  ) {
    lynx.reportError(
      new Error(`ElementTemplate hydrate remove received invalid uid ${String(handleId)}.`),
    );
    return null;
  }
  return handleId;
}

export function emitCreateSubtree(node: BackgroundElementTemplateInstance): void {
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

export function bindHydrationHandleId(
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

export function hydrateAttributeSlots(
  templateType: string,
  handleId: number,
  beforeSlots: SerializableValue[],
  afterSlots: SerializableValue[],
): void {
  const slotCount = Math.max(beforeSlots.length, afterSlots.length);
  const slotKinds = getMainThreadDynamicAttrSlotKinds(templateType);
  for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
    // Native serialization and background preparation may represent an absent slot differently.
    const beforeValue = beforeSlots[slotIndex] ?? null;
    const afterValue = afterSlots[slotIndex] ?? null;
    if (
      !shouldForceMainThreadHydrateSlot(slotKinds?.get(slotIndex), afterValue)
      && isDirectOrDeepEqual(beforeValue, afterValue)
    ) {
      continue;
    }
    globalCommitContext.ops.push(
      getAttributeSlotUpdateOp(templateType, slotIndex),
      handleId,
      slotIndex,
      afterValue,
    );
  }
}

function shouldForceMainThreadHydrateSlot(
  slotKind: MainThreadDynamicAttrKind | undefined,
  value: SerializableValue | undefined,
): boolean {
  if (slotKind === 'gesture') {
    return value != null;
  }
  if (slotKind === 'mt-event') {
    return isMTEventNativeWrapper(value);
  }
  if (slotKind === 'spread') {
    if (!isSpreadRecord(value)) {
      return false;
    }
    for (const key of Object.keys(value)) {
      if (key === 'main-thread:ref') {
        return true;
      }
      const entry = value[key];
      if (key === 'main-thread:gesture' && isGestureSlotValue(entry)) {
        return true;
      }
      if (isMainThreadEventPropKey(key) && isMTEventNativeWrapper(entry)) {
        return true;
      }
    }
    return false;
  }
  return slotKind === 'mt-ref'
    && (value == null || isMainThreadFunction((value as unknown as MTRefNativeWrapper).value));
}
