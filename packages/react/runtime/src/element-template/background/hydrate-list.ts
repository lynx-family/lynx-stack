// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { globalCommitContext } from './commit-context.js';
import { diffHydrateSlotChildren, getSerializedTypedListChildren } from './hydrate-matcher.js';
import type { HydrateChildListDiff, HydrateMatchedNodeCallback } from './hydrate-matcher.js';
import {
  bindHydrationHandleId,
  collectRemovableSerializedSubtreeHandleIdsInto,
  emitCreateSubtree,
  hydrateAttributeSlots,
} from './hydrate-patch.js';
import type { BackgroundElementTemplateInstance } from './shadow-instance.js';
import { toUpdateTypedListItemCommand } from './typed-instance.js';
import type { BackgroundListElementTemplateInstance } from './typed-instance.js';
import {
  COMPONENT_AT_INDEXES_ATTR,
  COMPONENT_AT_INDEX_ATTR,
  ENQUEUE_COMPONENT_ATTR,
  UPDATE_LIST_INFO_ATTR,
} from '../protocol/list.js';
import { ElementTemplateUpdateOps } from '../protocol/opcodes.js';
import type { SerializableValue, SerializedEtNode, SerializedTypedListNode } from '../protocol/types.js';

export function hydrateListInstance(
  serialized: SerializedTypedListNode,
  instance: BackgroundListElementTemplateInstance,
  hydrateMatchedNode: HydrateMatchedNodeCallback,
): boolean {
  if (__DEV__ && (serialized.childSlots?.length ?? 0) > 0) {
    lynx.reportError(new Error('ElementTemplate hydrate typed list does not support childSlots.'));
    return false;
  }

  const listChildren = getSerializedTypedListChildren(serialized);
  if (__DEV__ && !Array.isArray(listChildren)) {
    lynx.reportError(new Error('ElementTemplate hydrate typed list requires options.listChildren.'));
    return false;
  }

  const backgroundChildren = instance.childNodes;
  const handleId = serialized.uid;
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

  const listDiff = diffHydrateSlotChildren(listChildren, backgroundChildren, hydrateMatchedNode);
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
  attributes: SerializedTypedListNode['attributes'],
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
      itemId = serialized.uid;
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
    emitCreateSubtree(child);
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
