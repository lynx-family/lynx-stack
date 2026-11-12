// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { getAttributeSlotUpdateOp } from './attr-slots.js';
import { globalCommitContext, markRemovedSubtreeForPostDispatchTeardown } from './commit-context.js';
import {
  BUILTIN_RAW_TEXT_TEMPLATE_KEY,
  BackgroundListElementTemplateInstance,
  collectMainThreadRefSubtreeHandleIds,
  getContainingListItem,
} from './instance.js';
import type { BackgroundElementTemplateInstance } from './instance.js';
import { backgroundElementTemplateInstanceManager } from './manager.js';
import { isMainThreadFunction } from '../../core/main-thread-function.js';
import { isDirectOrDeepEqual } from '../../utils.js';
import { hydrationMap } from '../hydration-map.js';
import { isGestureSlotValue } from '../prop-adapters/gesture.js';
import { isMainThreadEventPropKey, isSpreadRecord } from '../prop-adapters/spread.js';
import { ElementTemplateUpdateOps } from '../protocol/opcodes.js';
import { ELEMENT_TEMPLATE_PAGE_HANDLE_ID, ELEMENT_TEMPLATE_PAGE_ROOT_SLOT_INDEX } from '../protocol/page.js';
import { elementTemplateIdentityKey, parseElementTemplateType } from '../protocol/template-type.js';
import type {
  SerializableValue,
  SerializedCompiledNode,
  SerializedEtNode,
  SerializedTypedListNode,
} from '../protocol/types.js';
import type { ETListItemPlatformInfo } from '../runtime/list/list.js';
import { getMainThreadDynamicAttrSlotKinds } from '../runtime/template/attr-slot-plan.js';
import type { MainThreadDynamicAttrKind } from '../runtime/template/attr-slot-plan.js';
import { isMTEventNativeWrapper } from '../runtime/template/main-thread-event-ctx.js';
import type { MTRefNativeWrapper } from '../runtime/template/main-thread-ref-ctx.js';

const MAIN_BUNDLE_URL_SENTINEL = '__Card__';

export function hydrateRootChildrenIntoContext(
  serializedChildren: SerializedEtNode[],
  root: BackgroundElementTemplateInstance,
): boolean {
  try {
    return hydrateChildListIntoContext(
      ELEMENT_TEMPLATE_PAGE_HANDLE_ID,
      ELEMENT_TEMPLATE_PAGE_ROOT_SLOT_INDEX,
      serializedChildren,
      root.childNodes,
    );
  } finally {
    // Template identities only need caching for this synchronous hydration pass.
    backgroundHydrateKeys.clear();
  }
}

function isSerializedCompiledNode(serialized: SerializedEtNode): serialized is SerializedCompiledNode {
  return typeof (serialized as { templateKey?: unknown }).templateKey === 'string';
}

function isSerializedTypedListNode(serialized: SerializedEtNode): serialized is SerializedTypedListNode {
  return !isSerializedCompiledNode(serialized) && serialized.tag === 'list';
}

interface HydrateChildListDiff {
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
    // Normalize the background instance's full `${entry}:${key}` type tag to the
    // same native identity the serialized side uses (sentinel folded to the main
    // card), so main-card nodes match regardless of the `__Card__` prefix.
    const backgroundKey = getBackgroundNodeHydrateKey(backgroundChild.type);
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
      } else {
        lastPlacedIndex = oldIndex;
      }
    } else {
      result.insertions[i] = backgroundChild;
      result.insertionCount += 1;
    }
  }

  for (const key in serializedByNodeKey) {
    const candidates = serializedByNodeKey[key]!;
    const candidateCursor = serializedCursorByNodeKey[key] ?? 0;
    for (let i = candidateCursor; i < candidates.length; i += 1) {
      result.removals.push(candidates[i]![1]);
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
  if (__DEV__ && !isSerializedTypedListNode(serialized)) {
    lynx.reportError(
      new Error(`ElementTemplate hydrate does not support serialized typed node '${serialized.tag}'.`),
    );
    return false;
  }
  // Match List items separately, then reuse the shared structural patch
  // emitter.
  return hydrateListInstance(
    serialized as SerializedTypedListNode,
    instance as BackgroundListElementTemplateInstance,
  );
}

function hydrateCompiledInstance(
  serialized: SerializedCompiledNode,
  instance: BackgroundElementTemplateInstance,
): boolean {
  const handleId = serialized.uid;
  if (!bindHydrationHandleId(instance, handleId, serialized.templateKey)) {
    return false;
  }
  if (serialized.attributeSlots?.length || instance.attributeSlots.length) {
    instance.prepareAttributeSlotsForHydration();
    hydrateAttributeSlots(instance.type, handleId, serialized.attributeSlots ?? [], instance.attributeSlots);
  }

  if (serialized.templateKey === BUILTIN_RAW_TEXT_TEMPLATE_KEY) {
    return true;
  }

  if (!serialized.childSlots?.length && !instance.firstChild) {
    return true;
  }

  const serializedChildSlots = serialized.childSlots ?? [];
  const backgroundChildSlots = instance.childSlots;
  // Snapshot hydrates dynamic children through slot-filtered lists. Keeping ET
  // scoped the same way means a cross-slot candidate is a source remove plus a
  // target create/insert, while same-slot reorder can still stay move-like.
  const slotCount = Math.max(serializedChildSlots.length, backgroundChildSlots.length);
  for (let slotId = 0; slotId < slotCount; slotId += 1) {
    const serializedSlot = serializedChildSlots[slotId];
    const backgroundSlot = backgroundChildSlots[slotId];
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

const backgroundHydrateKeys = new Map<string, string>();

function getBackgroundNodeHydrateKey(type: string): string {
  const cached = backgroundHydrateKeys.get(type);
  if (cached !== undefined) {
    return cached;
  }
  const parsed = parseElementTemplateType(type);
  const key = elementTemplateIdentityKey(parsed.templateKey, parsed.bundleUrl);
  backgroundHydrateKeys.set(type, key);
  return key;
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

function getSerializedTypedListChildren(
  serialized: SerializedTypedListNode,
): SerializedEtNode[] {
  // Native List stores logical items in childSlots[0].
  // A missing or empty slot 0 represents an empty List.
  return serialized.childSlots?.[0] ?? [];
}

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

function hydrateListInstance(
  serialized: SerializedTypedListNode,
  instance: BackgroundListElementTemplateInstance,
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
  const listDiff = hydrateMatchingListChildrenAndDiff(handleId, serializedChildren, backgroundChildren);
  if (listDiff === null) {
    return false;
  }

  // Reuse child-slot structural commands so native records List changes in slot
  // 0.
  return emitHydrateChildrenDiff(handleId, 0, serializedChildren, listDiff);
}

function hydrateMatchingListChildrenAndDiff(
  listHandleId: number,
  serializedChildren: SerializedEtNode[],
  backgroundChildren: BackgroundElementTemplateInstance[],
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

    if (!hydrateInstance(serialized, instance)) {
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

  // Preserve the full matcher’s FIFO pairing while avoiding its temporary
  // structures when every child already occupies the matching slot position.
  const length = serializedChildren.length;
  if (length === backgroundChildren.length) {
    let samePairwise = true;
    for (let i = 0; i < length; i += 1) {
      if (
        getSerializedNodeHydrateKey(serializedChildren[i]!)
          !== getBackgroundNodeHydrateKey(backgroundChildren[i]!.type)
      ) {
        samePairwise = false;
        break;
      }
    }
    if (samePairwise) {
      for (let i = 0; i < length; i += 1) {
        if (!hydrateInstance(serializedChildren[i]!, backgroundChildren[i]!)) {
          return false;
        }
      }
      return true;
    }
  }

  const listDiff = hydrateMatchingChildrenAndDiffSlot(serializedChildren, backgroundChildren);
  if (listDiff === null) {
    return false;
  }

  // Hydrate emits patches directly here. Replaying against serialized order
  // keeps insert targets in the main-thread slot without reshaping background.
  return emitHydrateChildrenDiff(targetHandleId, slotId, serializedChildren, listDiff);
}

function emitHydrateChildrenDiff(
  targetHandleId: number,
  slotId: number,
  serializedChildren: SerializedEtNode[],
  listDiff: HydrateChildListDiff,
): boolean {
  // serializedChildren supplies the old order and insertion anchors.
  // listDiff describes the target changes.
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
  // Collect all logical item UIDs from slot 0 when removing a List or its
  // ancestor.
  if (
    __DEV__
    && serializedList.childSlots?.some(
      (children, slotIndex) => slotIndex !== 0 && (children?.length ?? 0) > 0,
    )
  ) {
    lynx.reportError(new Error('ElementTemplate hydrate typed list only supports logical slot 0.'));
    return false;
  }
  const listChildren = getSerializedTypedListChildren(serializedList);
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
