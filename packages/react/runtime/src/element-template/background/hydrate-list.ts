// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { globalCommitContext } from './commit-context.js';
import {
  getBackgroundNodeHydrateKey,
  getSerializedNodeHydrateKey,
  getSerializedTypedListChildren,
} from './hydrate-matcher.js';
import type { HydrateChildListDiff } from './hydrate-matcher.js';
import {
  bindHydrationHandleId,
  consumeHydratedListItemSubtreeSync,
  emitHydrateChildrenDiff,
  hydrateAttributeSlots,
} from './hydrate-patch.js';
import type { BackgroundElementTemplateInstance } from './shadow-instance.js';
import { toUpdateTypedListItemCommand } from './typed-instance.js';
import type { BackgroundListElementTemplateInstance } from './typed-instance.js';
import { isDirectOrDeepEqual } from '../../core/deep-equal.js';
import { ElementTemplateUpdateOps } from '../protocol/opcodes.js';
import type { SerializedEtNode, SerializedTypedListNode } from '../protocol/types.js';
import type { ETListItemPlatformInfo } from '../runtime/list/list.js';

function getSerializedListItemPlatformInfo(
  serialized: SerializedEtNode,
): ETListItemPlatformInfo | undefined {
  const options = serialized.options;
  if (!options || !('__listItemPlatformInfo' in options)) {
    return undefined;
  }
  const platformInfo = options['__listItemPlatformInfo'];
  // Require an attribute object for platform info.
  if (
    platformInfo == null
    || typeof platformInfo !== 'object'
    || Array.isArray(platformInfo)
  ) {
    return undefined;
  }
  // Reuse the ET serializable attribute type and preserve the original object.
  return platformInfo as ETListItemPlatformInfo;
}

function getListItemHydrateKey(
  platformInfo: ETListItemPlatformInfo | undefined,
): string | undefined {
  const itemKey = platformInfo?.['item-key'];
  // Nullish item keys use the unkeyed group. Empty strings are valid keys.
  // Normalize provided keys to strings to preserve RL3's object-key grouping.
  return itemKey == null ? undefined : String(itemKey as string | number);
}

export function hydrateListInstance(
  serialized: SerializedTypedListNode,
  instance: BackgroundListElementTemplateInstance,
  hydrateChild: (
    serialized: SerializedEtNode,
    background: BackgroundElementTemplateInstance,
  ) => boolean,
): boolean {
  const serializedChildren = getSerializedTypedListChildren(serialized);
  const backgroundChildren = instance.childNodes;
  if (__DEV__) {
    // Both sides store logical List items in slot 0.
    const hasUnsupportedSerializedSlot = serialized.childSlots?.some(
      (children, slotIndex) => slotIndex !== 0 && (children?.length ?? 0) > 0,
    );
    // A child's __slotIndex identifies its logical slot.
    const hasUnsupportedBackgroundSlot = backgroundChildren.some(child => child.__slotIndex !== 0);
    if (hasUnsupportedSerializedSlot || hasUnsupportedBackgroundSlot) {
      lynx.reportError(new Error('ElementTemplate hydrate typed list only supports logical slot 0.'));
      return false;
    }
  }

  const handleId = serialized.uid;
  if (!bindHydrationHandleId(instance, handleId, serialized.tag)) {
    return false;
  }

  instance.prepareAttributeSlotsForHydration();

  hydrateAttributeSlots(
    serialized.tag,
    handleId,
    [serialized.attributes ?? null],
    instance.attributeSlots,
  );

  // The List UID and attributes are hydrated before this empty-children fast
  // path.
  if (serializedChildren.length === 0 && backgroundChildren.length === 0) {
    return true;
  }

  // Hydrate matched items recursively and preserve insertion, removal, and move
  // distinctions.
  const listDiff = hydrateMatchingListChildrenAndDiff(
    handleId,
    serializedChildren,
    backgroundChildren,
    hydrateChild,
  );
  if (listDiff === null) {
    return false;
  }

  // Reuse child-slot structural commands so native records List changes in slot
  // 0.
  if (!emitHydrateChildrenDiff(handleId, 0, serializedChildren, listDiff)) {
    return false;
  }
  for (let index = 0; index < backgroundChildren.length; index += 1) {
    const child = backgroundChildren[index]!;
    if (!consumeHydratedListItemSubtreeSync(child)) {
      continue;
    }
    globalCommitContext.ops.push(
      ElementTemplateUpdateOps.updateTypedListItem,
      handleId,
      toUpdateTypedListItemCommand(child, false),
    );
  }
  return true;
}

function hydrateMatchingListChildrenAndDiff(
  listHandleId: number,
  serializedChildren: SerializedEtNode[],
  backgroundChildren: BackgroundElementTemplateInstance[],
  hydrateChild: (
    serialized: SerializedEtNode,
    background: BackgroundElementTemplateInstance,
  ) => boolean,
): HydrateChildListDiff | null {
  const result: HydrateChildListDiff = {
    insertions: {},
    insertionCount: 0,
    removals: [],
    moves: {},
  };
  // Explicit item-key values are unique on each side, so each key maps to one
  // old node.
  const serializedByItemKey = new Map<string, SerializedEtNode>();
  // Group unkeyed nodes by template identity.
  // Preserve their old order and consume candidates with a per-template cursor.
  const serializedByTemplateKey = new Map<string, {
    nodes: SerializedEtNode[];
    cursor: number; // Index of the next candidate to consume, initially zero.
  }>();
  // Track old positions to detect moves.
  // Remove matched records so the remaining entries identify deleted nodes.
  const remainingOldIndices = new Map<SerializedEtNode, number>();

  for (let oldIndex = 0; oldIndex < serializedChildren.length; oldIndex++) {
    const serialized = serializedChildren[oldIndex]!;
    const itemKey = getListItemHydrateKey(
      getSerializedListItemPlatformInfo(serialized),
    );
    remainingOldIndices.set(serialized, oldIndex);
    if (itemKey !== undefined) {
      // Index keyed nodes for matching by item-key.
      serializedByItemKey.set(itemKey, serialized);
      continue;
    }
    // Queue unkeyed nodes by normalized template identity.
    const templateKey = getSerializedNodeHydrateKey(serialized);
    let group = serializedByTemplateKey.get(templateKey);
    if (group === undefined) {
      group = { nodes: [], cursor: 0 };
      serializedByTemplateKey.set(templateKey, group);
    }
    group.nodes.push(serialized);
  }

  let lastPlacedIndex = 0;
  for (let newIndex = 0; newIndex < backgroundChildren.length; newIndex++) {
    const instance = backgroundChildren[newIndex]!;
    const itemKey = getListItemHydrateKey(
      instance.getListItemPlatformInfo(),
    );
    const templateKey = getBackgroundNodeHydrateKey(instance.type);

    let serialized: SerializedEtNode | undefined;
    if (itemKey === undefined) {
      const group = serializedByTemplateKey.get(templateKey);
      serialized = group?.nodes[group.cursor];
    } else {
      serialized = serializedByItemKey.get(itemKey);
    }

    if (serialized === undefined || getSerializedNodeHydrateKey(serialized) !== templateKey) {
      // Record an insertion when no compatible candidate exists.
      result.insertions[newIndex] = instance;
      result.insertionCount += 1;
      // Keep the old candidate pending removal.
      continue;
    }

    if (!hydrateChild(serialized, instance)) {
      return null;
    }

    // The item now uses its native UID.
    // Emit updateTypedListItem when platform info changes.
    hydrateListItemPlatformInfo(listHandleId, serialized, instance);

    // Remove the matched node from the pending-removal map.
    const oldIndex = remainingOldIndices.get(serialized)!;
    remainingOldIndices.delete(serialized);
    if (itemKey === undefined) {
      serializedByTemplateKey.get(templateKey)!.cursor += 1;
    } else {
      serializedByItemKey.delete(itemKey);
    }
    if (oldIndex < lastPlacedIndex) {
      // Record a move for the retained item.
      result.moves[oldIndex] = {
        toIndex: newIndex,
        instance,
      };
    } else {
      lastPlacedIndex = oldIndex;
    }
  }
  // Remove the old nodes left unmatched.
  // The Map preserves old order, so remaining indexes are already sorted.
  for (const oldIndex of remainingOldIndices.values()) {
    result.removals.push(oldIndex);
  }
  return result;
}

function hydrateListItemPlatformInfo(
  listHandleId: number,
  serialized: SerializedEtNode,
  instance: BackgroundElementTemplateInstance,
): void {
  const before = getSerializedListItemPlatformInfo(serialized) ?? {};
  const after = instance.getListItemPlatformInfo();
  if (isDirectOrDeepEqual(before, after)) {
    return;
  }
  globalCommitContext.ops.push(
    ElementTemplateUpdateOps.updateTypedListItem,
    listHandleId,
    {
      __etHandleRef: serialized.uid,
      type: instance.type,
      platformInfo: after,
      subtreeHandleIds: null,
    },
  );
}
