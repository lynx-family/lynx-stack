// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  globalCommitContext,
  markRemovedSubtreeForPostDispatchTeardown,
  resetGlobalCommitContext,
} from './commit-context.js';
import { BUILTIN_RAW_TEXT_TEMPLATE_KEY } from './instance.js';
import type { BackgroundElementTemplateInstance } from './instance.js';
import { backgroundElementTemplateInstanceManager } from './manager.js';
import { isDirectOrDeepEqual } from '../../utils.js';
import { hydrationMap } from '../hydration-map.js';
import { ElementTemplateUpdateOps } from '../protocol/opcodes.js';
import { elementTemplateIdentityKey, parseElementTemplateType } from '../protocol/template-type.js';
import type {
  ElementTemplateUpdateCommandStream,
  SerializableValue,
  SerializedElementTemplate,
} from '../protocol/types.js';

export function hydrate(
  serialized: SerializedElementTemplate,
  instance: BackgroundElementTemplateInstance,
): ElementTemplateUpdateCommandStream {
  resetGlobalCommitContext();
  if (!hydrateIntoContext(serialized, instance)) {
    // Hydration protocol errors are not transactional: earlier matched nodes
    // may already be rebound while discovering a later mismatch. Discard the
    // native output for this failed pass and let the listener keep refs/events gated.
    resetGlobalCommitContext();
  }
  return globalCommitContext.ops;
}

export function hydrateIntoContext(
  serialized: SerializedElementTemplate,
  instance: BackgroundElementTemplateInstance,
): boolean {
  return hydrateInstance(serialized, instance);
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
  serializedChildren: SerializedElementTemplate[],
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
  const serializedByIdentityKey: Record<string, [SerializedElementTemplate, number][]> = {};
  const serializedCursorByIdentityKey: Record<string, number> = {};

  for (let i = 0; i < serializedChildren.length; i += 1) {
    const node = serializedChildren[i]!;
    const identityKey = elementTemplateIdentityKey(node.templateKey, node.bundleUrl);
    (serializedByIdentityKey[identityKey] ??= []).push([node, i]);
  }

  for (let i = 0; i < backgroundChildren.length; i += 1) {
    const backgroundChild = backgroundChildren[i]!;
    const identityKey = backgroundChild.type;
    const serializedCandidates = serializedByIdentityKey[identityKey];
    const candidateCursor = serializedCursorByIdentityKey[identityKey] ?? 0;
    const matchedSerialized = serializedCandidates?.[candidateCursor];

    if (matchedSerialized) {
      serializedCursorByIdentityKey[identityKey] = candidateCursor + 1;
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

  for (const key in serializedByIdentityKey) {
    const candidates = serializedByIdentityKey[key]!;
    const candidateCursor = serializedCursorByIdentityKey[key] ?? 0;
    for (let i = candidateCursor; i < candidates.length; i += 1) {
      result.removals.push(candidates[i]![1]);
      result.hasChanges = true;
    }
  }

  return result;
}

function hydrateInstance(
  serialized: SerializedElementTemplate,
  instance: BackgroundElementTemplateInstance,
): boolean {
  const nativeTemplate = parseElementTemplateType(instance.type);
  const serializedBundleUrl = serialized.bundleUrl ?? null;
  if (
    serialized.templateKey !== nativeTemplate.templateKey
    || serializedBundleUrl !== nativeTemplate.bundleUrl
  ) {
    if (__DEV__) {
      lynx.reportError(
        new Error(
          `ElementTemplate hydrate key mismatch: main='${
            elementTemplateIdentityKey(serialized.templateKey, serializedBundleUrl)
          }' background='${instance.type}'.`,
        ),
      );
    }
    return false;
  }

  const handleId = serialized.uid as number;
  if (!bindHydrationHandleId(instance, handleId, serialized.templateKey)) {
    return false;
  }
  instance.prepareAttributeSlotsForHydration();
  hydrateAttributeSlots(handleId, serialized.attributeSlots ?? [], instance.attributeSlots);

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
    if (!hydrateElementSlot(instance, slotId, serializedSlot ?? [], backgroundSlot ?? [])) {
      return false;
    }
  }
  return true;
}

function hydrateElementSlot(
  parent: BackgroundElementTemplateInstance,
  slotId: number,
  serializedChildren: SerializedElementTemplate[],
  backgroundChildren: BackgroundElementTemplateInstance[],
): boolean {
  if (backgroundChildren.length === 0) {
    for (const serialized of serializedChildren) {
      emitSerializedSubtreeRemove(parent, slotId, serialized);
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
      emitSerializedSubtreeRemove(parent, slotId, currentSerializedChild);
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
          parent.instanceId,
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
          parent.instanceId,
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
  parent: BackgroundElementTemplateInstance,
  slotId: number,
  serialized: SerializedElementTemplate,
): void {
  const childId = serialized.uid as number;
  const existing = backgroundElementTemplateInstanceManager.get(childId);
  // The removed child may no longer have a live background instance in this
  // slot, so serialized data is the source of truth for registry cleanup.
  const removedSubtreeHandleIds: number[] = [];
  collectSerializedSubtreeHandleIdsInto(serialized, removedSubtreeHandleIds);
  globalCommitContext.ops.push(
    ElementTemplateUpdateOps.removeNode,
    parent.instanceId,
    slotId,
    childId,
    removedSubtreeHandleIds,
  );
  if (existing && !existing.parent) {
    markRemovedSubtreeForPostDispatchTeardown(existing);
  }
}

function collectSerializedSubtreeHandleIdsInto(
  serialized: SerializedElementTemplate,
  handles: number[],
): void {
  handles.push(serialized.uid as number);
  for (const slotChildren of serialized.elementSlots ?? []) {
    if (!slotChildren) {
      continue;
    }
    for (const child of slotChildren) {
      collectSerializedSubtreeHandleIdsInto(child, handles);
    }
  }
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
  try {
    backgroundElementTemplateInstanceManager.updateId(instance.instanceId, handleId);
    // Ref proxies created before hydrate keep the old background id; resolve it
    // lazily so user-held proxies continue selecting the hydrated native node.
    hydrationMap.set(oldHandleId, handleId);
    instance.markMaterializedByHydration();
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

function hydrateAttributeSlots(
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
