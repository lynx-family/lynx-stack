// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { GlobalCommitContext, markRemovedSubtreeForCurrentCommit, resetGlobalCommitContext } from './commit-context.js';
import { BUILTIN_RAW_TEXT_TEMPLATE_KEY } from './instance.js';
import type { BackgroundElementTemplateInstance } from './instance.js';
import { backgroundElementTemplateInstanceManager } from './manager.js';
import { isDirectOrDeepEqual } from '../../utils.js';
import { ElementTemplateUpdateOps } from '../protocol/opcodes.js';
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
  hydrateIntoContext(serialized, instance);
  return GlobalCommitContext.ops;
}

export function hydrateIntoContext(
  serialized: SerializedElementTemplate,
  instance: BackgroundElementTemplateInstance,
): void {
  hydrateInstance(serialized, instance);
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
): HydrateChildListDiff {
  let lastPlacedIndex = 0;
  const result: HydrateChildListDiff = {
    hasChanges: false,
    insertions: {},
    insertionCount: 0,
    removals: [],
    moves: {},
  };
  const serializedByTemplateKey: Record<string, [SerializedElementTemplate, number][]> = {};
  const serializedCursorByTemplateKey: Record<string, number> = {};

  for (let i = 0; i < serializedChildren.length; i += 1) {
    const node = serializedChildren[i]!;
    (serializedByTemplateKey[node.templateKey] ??= []).push([node, i]);
  }

  for (let i = 0; i < backgroundChildren.length; i += 1) {
    const backgroundChild = backgroundChildren[i]!;
    const serializedCandidates = serializedByTemplateKey[backgroundChild.type];
    const candidateCursor = serializedCursorByTemplateKey[backgroundChild.type] ?? 0;
    const matchedSerialized = serializedCandidates?.[candidateCursor];

    if (matchedSerialized) {
      serializedCursorByTemplateKey[backgroundChild.type] = candidateCursor + 1;
      const oldIndex = matchedSerialized[1];
      hydrateInstance(matchedSerialized[0], backgroundChild);
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

  for (const key in serializedByTemplateKey) {
    const candidates = serializedByTemplateKey[key]!;
    const candidateCursor = serializedCursorByTemplateKey[key] ?? 0;
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
): void {
  if (serialized.templateKey !== instance.type) {
    if (__DEV__) {
      lynx.reportError(
        new Error(
          `ElementTemplate hydrate key mismatch: main='${serialized.templateKey}' background='${instance.type}'.`,
        ),
      );
    }
    return;
  }

  const handleId = serialized.uid as number;
  if (!bindHydrationHandleId(instance, handleId, serialized.templateKey)) {
    return;
  }
  hydrateAttributeSlots(handleId, serialized.attributeSlots, instance.attributeSlots);

  if (serialized.templateKey === BUILTIN_RAW_TEXT_TEMPLATE_KEY) {
    return;
  }

  const serializedElementSlots = serialized.elementSlots;
  // Snapshot hydrates dynamic children through slot-filtered lists. Keeping ET
  // scoped the same way means a cross-slot candidate is a source remove plus a
  // target create/insert, while same-slot reorder can still stay move-like.
  const slotCount = Math.max(serializedElementSlots.length, instance.elementSlots.length);
  for (let slotId = 0; slotId < slotCount; slotId += 1) {
    const serializedSlot = serializedElementSlots[slotId];
    const backgroundSlot = instance.elementSlots[slotId];
    if (!serializedSlot && !backgroundSlot) {
      continue;
    }
    hydrateElementSlot(instance, slotId, serializedSlot ?? []);
  }
}

function hydrateElementSlot(
  parent: BackgroundElementTemplateInstance,
  slotId: number,
  serializedChildren: SerializedElementTemplate[],
): void {
  const backgroundChildren = parent.elementSlots[slotId] ?? [];
  if (backgroundChildren.length === 0) {
    for (const serialized of serializedChildren) {
      emitSerializedSubtreeRemove(parent, slotId, serialized);
    }
    return;
  }

  const listDiff = hydrateMatchingChildrenAndDiffSlot(serializedChildren, backgroundChildren);

  if (!listDiff.hasChanges) {
    return;
  }

  // Hydrate emits patches directly here. Replaying against serialized order
  // keeps insert targets in the main-thread slot without reshaping background.
  const removalIndexes = new Set(listDiff.removals);
  const { insertions, moves } = listDiff;
  const pendingMoves = new Map<number, BackgroundElementTemplateInstance>();
  let serializedCursor = 0;
  let currentSerializedChild = serializedChildren[serializedCursor];
  let newIndex = 0;
  let oldIndex = 0;
  // Insertions are known before replay starts. Moves are counted only when their
  // old serialized position is reached, so the cursor can keep emitting patches
  // even after all serialized children have been consumed.
  let pendingInsertOrMovePatchCount = listDiff.insertionCount;
  while (currentSerializedChild || pendingInsertOrMovePatchCount > 0) {
    let keepCurrentSerializedChild = false;
    if (currentSerializedChild && removalIndexes.has(oldIndex)) {
      emitSerializedSubtreeRemove(parent, slotId, currentSerializedChild);
    } else if (currentSerializedChild && moves[oldIndex] !== undefined) {
      const move = moves[oldIndex]!;
      pendingMoves.set(move.toIndex, move.instance);
      pendingInsertOrMovePatchCount += 1;
    } else {
      const beforeChildId = currentSerializedChild ? currentSerializedChild.uid as number : 0;
      const movedChild = pendingMoves.get(newIndex);
      if (movedChild) {
        keepCurrentSerializedChild = true;
        GlobalCommitContext.ops.push(
          ElementTemplateUpdateOps.insertNode,
          parent.instanceId,
          slotId,
          movedChild.instanceId,
          beforeChildId,
        );
        pendingInsertOrMovePatchCount -= 1;
      } else if (insertions[newIndex] !== undefined) {
        const insertedChild = insertions[newIndex]!;
        keepCurrentSerializedChild = true;
        emitCreateSubtree(insertedChild);
        GlobalCommitContext.ops.push(
          ElementTemplateUpdateOps.insertNode,
          parent.instanceId,
          slotId,
          insertedChild.instanceId,
          beforeChildId,
        );
        pendingInsertOrMovePatchCount -= 1;
      }

      newIndex += 1;
    }
    if (currentSerializedChild && !keepCurrentSerializedChild) {
      currentSerializedChild = serializedChildren[++serializedCursor];
      oldIndex += 1;
    }
  }
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
  GlobalCommitContext.ops.push(
    ElementTemplateUpdateOps.removeNode,
    parent.instanceId,
    slotId,
    childId,
    removedSubtreeHandleIds,
  );
  if (existing && !existing.parent) {
    markRemovedSubtreeForCurrentCommit(existing);
  }
}

function collectSerializedSubtreeHandleIdsInto(
  serialized: SerializedElementTemplate,
  handles: number[],
): void {
  handles.push(serialized.uid as number);
  for (const slotChildren of serialized.elementSlots) {
    if (!slotChildren) {
      continue;
    }
    for (const child of slotChildren) {
      collectSerializedSubtreeHandleIdsInto(child, handles);
    }
  }
}

function emitCreateSubtree(node: BackgroundElementTemplateInstance): void {
  for (const slotChildren of node.elementSlots) {
    /* v8 ignore start */
    if (!slotChildren) {
      continue;
    }
    /* v8 ignore stop */
    for (const child of slotChildren) {
      emitCreateSubtree(child);
    }
  }
  node.emitCreate();
}

function bindHydrationHandleId(
  instance: BackgroundElementTemplateInstance,
  handleId: number,
  templateKey: string,
): boolean {
  try {
    backgroundElementTemplateInstanceManager.updateId(instance.instanceId, handleId);
    instance.markCreateEmittedForHydration();
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
    GlobalCommitContext.ops.push(
      ElementTemplateUpdateOps.setAttribute,
      handleId,
      slotIndex,
      afterValue ?? null,
    );
  }
}
