// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { isDirectOrDeepEqual } from '../../../utils.js';
import type {
  RuntimeAttributeSlotValue,
  RuntimeTypedElementAttributes,
  SerializableValue,
} from '../../protocol/types.js';

const LIST_ELEMENT_SLOT_INDEX = 0;
const COMPONENT_AT_INDEX_ATTR = 'component-at-index';
const COMPONENT_AT_INDEXES_ATTR = 'component-at-indexes';
const ENQUEUE_COMPONENT_ATTR = 'enqueue-component';

export type ETListItemPlatformInfo = Record<string, SerializableValue>;

export interface ETListItemMeta {
  templateKey: string;
  platformInfo: ETListItemPlatformInfo;
}

interface ETListItemRecord extends ETListItemMeta {
  // Stable ET handle shared by BTS command streams, MTS registry, and native
  // list callback return values.
  uid: number;
  // Native item root ref. The root can exist detached until native requests it.
  ref: ElementRef;
  // True after `component-at-index(es)` has inserted this item root into the
  // list's native slot.
  attached: boolean;
  // Same-list reorder keeps the item attached, but the next callback must still
  // call insert so native moves the existing child to the new sibling position.
  needsAttachMove: boolean;
  // Native may enqueue the old cell after an attached item has already moved to
  // the new position. Skipping that one detach preserves Snapshot move ordering.
  skipNextEnqueue: boolean;
}

interface ETListCallbacks {
  componentAtIndex: ComponentAtIndexCallback;
  componentAtIndexes: ComponentAtIndexesCallback;
  enqueueComponent: EnqueueComponentCallback;
}

export interface ETListState {
  // Stable ET handle of the typed list holder; filled when the native holder is
  // created and registered.
  listHandleId: number | null;
  // Typed list TemplateElement returned by native create. Native invokes list
  // callbacks with the materialized ListElement root, but ET slot APIs need the
  // TemplateElement holder as their target.
  holderRef: ElementRef | null;
  // Current logical order. Mutation commands update this immediately so stable
  // callbacks observe the latest committed-by-JS list shape.
  items: ETListItemRecord[];
  // Native sign -> item lookup for list callbacks. This is not the attached
  // item set: removed visible items stay addressable until native enqueues the
  // old sign while applying the final `update-list-info`.
  callbackItemBySign: Map<number, ETListItemRecord>;
  // Holder teardown keeps callbacks Snapshot-safe for late native calls.
  destroyed: boolean;
  // True while one or more currently attached items need same-list placement.
  // The next list callback reorders attached refs once, from right to left.
  hasAttachedMoves: boolean;
  // Latest typed slot 0 attrs excluding list callbacks and transient
  // `update-list-info`; final list flush composes these with stable callbacks.
  attributes: RuntimeTypedElementAttributes;
  // Stable callback identities installed on native slot 0. They read mutable
  // `ETListState` instead of being recreated for every list update.
  callbacks: ETListCallbacks;
}

export interface ETListUpdateItem extends ETListItemMeta {
  uid: number;
  ref: ElementRef;
}

export interface ETListUpdateInfo {
  insertAction: Array<{ position: number; type: string } & ETListItemPlatformInfo>;
  removeAction: number[];
  updateAction: Array<{ from: number; to: number; type: string; flush: boolean } & ETListItemPlatformInfo>;
}

export interface ETListFlushResult {
  uid: number;
  attributes: RuntimeTypedElementAttributes;
  removedSubtreeHandleIds?: number[];
}

interface PendingETListUpdate {
  // Mutable list state being updated by this patch stream.
  state: ETListState;
  // Logical order before the first mutation for this list in the current patch.
  // Native `update-list-info` is computed once from this baseline to final state.
  beforeItems: ETListItemRecord[];
  // Old committed uid -> index lookup for classifying removals and moved items.
  beforeIndexByUid: Map<number, number>;
  // Uids removed from `beforeItems`; flushed as old indexes in `removeAction`.
  removeUids: Set<number>;
  // Uids inserted into final state, including new items and remove+insert moves.
  // Flush derives final positions by scanning `state.items` once.
  insertUids: Set<number>;
  // React lifetime removals release MTS strong refs only after the final native
  // `update-list-info` write. Same-list move/reorder removals intentionally
  // leave this unset.
  removedSubtreeHandleIds?: number[];
}

const listItemByUid = /* @__PURE__ */ new Map<number, ETListItemRecord>();
const listStateByUid = /* @__PURE__ */ new Map<number, ETListState>();
const pendingInitialListUpdateUids = /* @__PURE__ */ new Set<number>();
const pendingListUpdates = /* @__PURE__ */ new Map<number, PendingETListUpdate>();

export function registerElementTemplateListItem(
  uid: number,
  ref: ElementRef,
  meta: ETListItemMeta,
): void {
  listItemByUid.set(uid, {
    uid,
    ref,
    templateKey: meta.templateKey,
    platformInfo: meta.platformInfo,
    attached: false,
    needsAttachMove: false,
    skipNextEnqueue: false,
  });
}

export function createElementTemplateListState(
  listItemUids: readonly number[],
  attributes?: RuntimeTypedElementAttributes | null,
): ETListState {
  const items: ETListItemRecord[] = [];
  for (let index = 0; index < listItemUids.length; index += 1) {
    const uid = listItemUids[index]!;
    const item = listItemByUid.get(uid);
    if (__DEV__ && !item) {
      throw new Error('Element Template typed list received a non-list-item root in logical slot $0.');
    }
    listItemByUid.delete(uid);
    items.push(item!);
  }

  return createElementTemplateListStateWithRecords(items, attributes);
}

export function createElementTemplateListInitialUpdateInfo(state: ETListState): ETListUpdateInfo {
  const insertAction: ETListUpdateInfo['insertAction'] = [];
  for (let index = 0; index < state.items.length; index += 1) {
    insertAction.push(toInsertAction(state.items[index]!, index));
  }
  return {
    insertAction,
    removeAction: [],
    updateAction: [],
  };
}

export function createElementTemplateListStateFromItems(
  items: ETListUpdateItem[],
  attributes?: RuntimeTypedElementAttributes | null,
): ETListState {
  const records: ETListItemRecord[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!;
    records.push({
      uid: item.uid,
      ref: item.ref,
      templateKey: item.templateKey,
      platformInfo: item.platformInfo,
      attached: false,
      needsAttachMove: false,
      skipNextEnqueue: false,
    });
  }

  return createElementTemplateListStateWithRecords(records, attributes);
}

function createElementTemplateListStateWithRecords(
  items: ETListItemRecord[],
  attributes?: RuntimeTypedElementAttributes | null,
): ETListState {
  const state: ETListState = {
    listHandleId: null,
    holderRef: null,
    items,
    callbackItemBySign: new Map(),
    destroyed: false,
    hasAttachedMoves: false,
    attributes: attributes ?? {},
    callbacks: null as unknown as ETListCallbacks,
  };
  state.callbacks = {
    componentAtIndex: createComponentAtIndexCallback(state),
    componentAtIndexes: createComponentAtIndexesCallback(state),
    enqueueComponent: createEnqueueComponentCallback(state),
  };
  return state;
}

export function registerElementTemplateListState(
  uid: number,
  state: ETListState,
  needsInitialFlush: boolean,
  holderRef: ElementRef,
): void {
  state.listHandleId = uid;
  state.holderRef = holderRef;
  listStateByUid.set(uid, state);
  if (needsInitialFlush) {
    pendingInitialListUpdateUids.add(uid);
  }
}

export function markElementTemplateListDestroyed(uid: number): number[] | undefined {
  const state = listStateByUid.get(uid);
  if (!state) {
    return undefined;
  }
  state.destroyed = true;
  state.callbackItemBySign.clear();
  listStateByUid.delete(uid);
  pendingInitialListUpdateUids.delete(uid);
  const pendingUpdate = pendingListUpdates.get(uid);
  pendingListUpdates.delete(uid);
  return pendingUpdate?.removedSubtreeHandleIds;
}

export function destroyAllElementTemplateListStates(): void {
  for (const state of listStateByUid.values()) {
    state.destroyed = true;
    state.callbackItemBySign.clear();
  }
  listStateByUid.clear();
  listItemByUid.clear();
  pendingInitialListUpdateUids.clear();
  pendingListUpdates.clear();
}

export function updateElementTemplateListAttributes(
  uid: number,
  attributes: RuntimeTypedElementAttributes | null | undefined,
  updateListInfo?: ETListUpdateInfo,
): RuntimeTypedElementAttributes | null {
  const state = listStateByUid.get(uid);
  if (!state) {
    return null;
  }
  return composeElementTemplateListAttributes(attributes, state, updateListInfo);
}

export function insertElementTemplateListItem(
  uid: number,
  item: ETListUpdateItem,
  beforeUid: number,
): void {
  const state = listStateByUid.get(uid)!;
  const pendingUpdate = markPendingListUpdate(uid, state);
  const previousIndex = pendingUpdate.beforeIndexByUid.get(item.uid);
  const previousRecord = previousIndex === undefined ? undefined : pendingUpdate.beforeItems[previousIndex];

  const needsAttachMove = previousRecord?.attached === true;
  const record: ETListItemRecord = {
    uid: item.uid,
    ref: item.ref,
    templateKey: item.templateKey,
    platformInfo: item.platformInfo,
    attached: previousRecord?.attached ?? false,
    needsAttachMove,
    skipNextEnqueue: previousRecord?.skipNextEnqueue ?? false,
  };
  if (needsAttachMove) {
    state.hasAttachedMoves = true;
  }
  if (beforeUid === 0) {
    state.items.push(record);
  } else {
    state.items.splice(findListItemIndexByUid(state.items, beforeUid), 0, record);
  }
  pendingUpdate.insertUids.add(item.uid);
}

export function removeElementTemplateListItem(
  uid: number,
  itemUid: number,
  removedSubtreeHandleIds: readonly number[],
): void {
  const state = listStateByUid.get(uid)!;
  const pendingUpdate = markPendingListUpdate(uid, state);
  state.items.splice(findListItemIndexByUid(state.items, itemUid), 1);
  pendingUpdate.removeUids.add(itemUid);
  if (removedSubtreeHandleIds.length > 0) {
    (pendingUpdate.removedSubtreeHandleIds ??= []).push(...removedSubtreeHandleIds);
  }
}

export function updateElementTemplateListItem(
  uid: number,
  item: ETListUpdateItem,
): void {
  const state = listStateByUid.get(uid)!;
  const index = findListItemIndexByUid(state.items, item.uid);
  const previous = state.items[index]!;
  const hasCurrentChange = previous.templateKey !== item.templateKey
    || !isDirectOrDeepEqual(previous.platformInfo, item.platformInfo);
  if (!hasCurrentChange) {
    // Hydrate emits retained item refreshes without serialized platformInfo, so
    // unchanged items must not dirty the list or trigger an empty final flush.
    return;
  }
  if (!pendingListUpdates.has(uid)) {
    markPendingListUpdate(uid, state);
  }
  state.items[index] = {
    uid: item.uid,
    ref: item.ref,
    templateKey: item.templateKey,
    platformInfo: item.platformInfo,
    attached: previous.attached,
    needsAttachMove: previous.needsAttachMove,
    skipNextEnqueue: previous.skipNextEnqueue,
  };
}

export function flushPendingElementTemplateListUpdates(): ETListFlushResult[] {
  const results: ETListFlushResult[] = [];
  for (const [uid, pendingUpdate] of pendingListUpdates) {
    const { state } = pendingUpdate;
    const updateInfo = collectRecordedListUpdateInfo(pendingUpdate);
    refreshCallbackItemsBySign(state);
    const result: ETListFlushResult = {
      uid,
      attributes: composeElementTemplateListAttributes(undefined, state, updateInfo),
    };
    if (pendingUpdate.removedSubtreeHandleIds) {
      result.removedSubtreeHandleIds = pendingUpdate.removedSubtreeHandleIds;
    }
    results.push(result);
  }
  pendingListUpdates.clear();
  return results;
}

export function flushInitialElementTemplateListUpdates(): ETListFlushResult[] {
  const results: ETListFlushResult[] = [];
  for (const uid of pendingInitialListUpdateUids) {
    const state = listStateByUid.get(uid)!;
    results.push({
      uid,
      attributes: composeElementTemplateListAttributes(
        undefined,
        state,
        createElementTemplateListInitialUpdateInfo(state),
      ),
    });
  }
  pendingInitialListUpdateUids.clear();
  return results;
}

export function composeElementTemplateListAttributes(
  attributes: RuntimeTypedElementAttributes | null | undefined,
  state: ETListState,
  updateListInfo?: ETListUpdateInfo,
): RuntimeTypedElementAttributes {
  if (attributes !== undefined) {
    state.attributes = attributes ?? {};
  }

  const callbacks = state.callbacks;
  const nextAttributes: RuntimeTypedElementAttributes = {
    ...state.attributes,
    [COMPONENT_AT_INDEX_ATTR]: callbacks.componentAtIndex as unknown as RuntimeAttributeSlotValue,
    [COMPONENT_AT_INDEXES_ATTR]: callbacks.componentAtIndexes as unknown as RuntimeAttributeSlotValue,
    [ENQUEUE_COMPONENT_ATTR]: callbacks.enqueueComponent as unknown as RuntimeAttributeSlotValue,
  };
  if (updateListInfo) {
    nextAttributes['update-list-info'] = updateListInfo as unknown as RuntimeAttributeSlotValue;
  }
  return nextAttributes;
}

function createComponentAtIndexCallback(state: ETListState): ComponentAtIndexCallback {
  return function componentAtIndex(
    _list,
    listID,
    cellIndex,
    operationID,
    enableReuseNotification,
  ) {
    const shouldLog = typeof __ALOG__ !== 'undefined' && __ALOG__;
    if (shouldLog) {
      logListCallbackAlog('component-at-index called', {
        destroyed: state.destroyed,
        listHandleId: state.listHandleId,
        listID,
        cellIndex,
        operationID,
        enableReuseNotification,
        itemCount: state.items.length,
      });
    }
    if (state.destroyed) {
      if (shouldLog) {
        logListCallbackAlog('component-at-index returned', {
          listHandleId: state.listHandleId,
          listID,
          cellIndex,
          operationID,
          sign: -1,
          reason: 'destroyed',
        });
      }
      return -1;
    }
    const sign = attachListItemAtIndex(
      state,
      state.holderRef!,
      listID,
      cellIndex,
      operationID,
      false,
    );
    if (shouldLog) {
      logListCallbackAlog('component-at-index returned', {
        listHandleId: state.listHandleId,
        listID,
        cellIndex,
        operationID,
        sign,
      });
    }
    return sign;
  } as ComponentAtIndexCallback;
}

function createComponentAtIndexesCallback(state: ETListState): ComponentAtIndexesCallback {
  return function componentAtIndexes(
    _list,
    listID,
    cellIndexes,
    operationIDs,
    enableReuseNotification,
    asyncFlush,
  ) {
    const shouldLog = typeof __ALOG__ !== 'undefined' && __ALOG__;
    if (shouldLog) {
      logListCallbackAlog('component-at-indexes called', {
        destroyed: state.destroyed,
        listHandleId: state.listHandleId,
        listID,
        cellIndexes,
        operationIDs,
        enableReuseNotification,
        asyncFlush,
        itemCount: state.items.length,
      });
    }
    if (state.destroyed) {
      if (shouldLog) {
        logListCallbackAlog('component-at-indexes returned', {
          listHandleId: state.listHandleId,
          listID,
          cellIndexes,
          operationIDs,
          elementIDs: [],
          reason: 'destroyed',
        });
      }
      return;
    }
    const elementIDs = cellIndexes.map((cellIndex, index) =>
      attachListItemAtIndex(
        state,
        state.holderRef!,
        listID,
        cellIndex,
        operationIDs[index],
        true,
        asyncFlush,
      )
    );
    if (shouldLog) {
      logListCallbackAlog('component-at-indexes flush', {
        listHandleId: state.listHandleId,
        listID,
        operationIDs,
        elementIDs,
      });
    }
    __FlushElementTree(state.holderRef!, {
      triggerLayout: true,
      operationIDs,
      elementIDs,
      listID,
    });
  };
}

function createEnqueueComponentCallback(state: ETListState): EnqueueComponentCallback {
  return function enqueueComponent(_list, listID, sign) {
    const shouldLog = typeof __ALOG__ !== 'undefined' && __ALOG__;
    if (shouldLog) {
      logListCallbackAlog('enqueue-component called', {
        destroyed: state.destroyed,
        listHandleId: state.listHandleId,
        listID,
        sign,
        itemSigns: Array.from(state.callbackItemBySign.keys()),
      });
    }
    if (state.destroyed) {
      if (shouldLog) {
        logListCallbackAlog('enqueue-component returned', {
          listHandleId: state.listHandleId,
          listID,
          sign,
          reason: 'destroyed',
        });
      }
      return;
    }
    const item = state.callbackItemBySign.get(sign);
    if (!item) {
      if (shouldLog) {
        logListCallbackAlog('enqueue-component returned', {
          listHandleId: state.listHandleId,
          listID,
          sign,
          reason: 'item-not-attached',
        });
      }
      return;
    }
    if (!item.attached) {
      state.callbackItemBySign.delete(sign);
      if (shouldLog) {
        logListCallbackAlog('enqueue-component returned', {
          listHandleId: state.listHandleId,
          listID,
          sign,
          itemHandleId: item.uid,
          reason: 'item-not-attached',
        });
      }
      return;
    }
    if (item.skipNextEnqueue) {
      item.skipNextEnqueue = false;
      if (shouldLog) {
        logListCallbackAlog('enqueue-component returned', {
          listHandleId: state.listHandleId,
          listID,
          sign,
          itemHandleId: item.uid,
          reason: 'skip-next-enqueue',
        });
      }
      return;
    }

    __RemoveNodeFromElementTemplate(state.holderRef!, LIST_ELEMENT_SLOT_INDEX, item.ref);
    item.attached = false;
    item.needsAttachMove = false;
    state.callbackItemBySign.delete(sign);
    if (shouldLog) {
      logListCallbackAlog('enqueue-component detached', {
        listHandleId: state.listHandleId,
        listID,
        sign,
        itemHandleId: item.uid,
      });
    }
  };
}

function attachListItemAtIndex(
  state: ETListState,
  list: ElementRef,
  listID: number,
  cellIndex: number,
  operationID: unknown,
  batchMode: boolean,
  asyncFlush: boolean = false,
): number {
  const maybeItem = state.items[cellIndex];
  if (__DEV__ && maybeItem === undefined) {
    throw new Error(`Element Template typed list item at index ${cellIndex} was not found.`);
  }
  const item = maybeItem!;
  const shouldLog = typeof __ALOG__ !== 'undefined' && __ALOG__;

  if (shouldLog) {
    logListCallbackAlog('attach-list-item start', {
      listHandleId: state.listHandleId,
      listID,
      cellIndex,
      operationID,
      batchMode,
      asyncFlush,
      itemHandleId: item.uid,
      templateKey: item.templateKey,
      attached: item.attached,
      needsAttachMove: item.needsAttachMove,
    });
  }
  moveAttachedListItemsIntoFinalOrder(state, list);
  if (!item.attached) {
    const referenceItem = findNextAttachedItem(state, cellIndex);
    const referenceRef = referenceItem?.ref ?? null;
    __InsertNodeToElementTemplate(list, LIST_ELEMENT_SLOT_INDEX, item.ref, referenceRef);
    item.attached = true;
    item.needsAttachMove = false;
    if (shouldLog) {
      logListCallbackAlog('attach-list-item inserted', {
        listHandleId: state.listHandleId,
        listID,
        cellIndex,
        itemHandleId: item.uid,
        referenceHandleId: referenceItem?.uid ?? null,
      });
    }
  }

  const sign = __GetElementUniqueID(item.ref);
  state.callbackItemBySign.set(sign, item);
  if (shouldLog) {
    logListCallbackAlog('attach-list-item sign', {
      listHandleId: state.listHandleId,
      listID,
      cellIndex,
      itemHandleId: item.uid,
      sign,
      batchMode,
      asyncFlush,
    });
  }

  if (!batchMode) {
    if (shouldLog) {
      logListCallbackAlog('attach-list-item flush', {
        listHandleId: state.listHandleId,
        listID,
        cellIndex,
        operationID,
        elementID: sign,
        targetHandleId: item.uid,
        triggerLayout: true,
      });
    }
    __FlushElementTree(item.ref, {
      triggerLayout: true,
      operationID,
      elementID: sign,
      listID,
    });
  } else if (asyncFlush) {
    if (shouldLog) {
      logListCallbackAlog('attach-list-item async flush', {
        listHandleId: state.listHandleId,
        listID,
        cellIndex,
        targetHandleId: item.uid,
        asyncFlush: true,
      });
    }
    __FlushElementTree(item.ref, {
      asyncFlush: true,
    });
  }

  return sign;
}

function logListCallbackAlog(message: string, payload: Record<string, unknown>): void {
  console.alog?.(
    `[ReactLynxDebug] ElementTemplate list callback ${message}:\n`
      + JSON.stringify(payload, null, 2),
  );
}

function moveAttachedListItemsIntoFinalOrder(
  state: ETListState,
  list: ElementRef,
): void {
  if (!state.hasAttachedMoves) {
    return;
  }

  let referenceRef: ElementRef | null = null;
  for (let index = state.items.length - 1; index >= 0; index -= 1) {
    const item = state.items[index]!;
    if (!item.attached) {
      item.needsAttachMove = false;
      continue;
    }
    if (item.needsAttachMove) {
      __InsertNodeToElementTemplate(list, LIST_ELEMENT_SLOT_INDEX, item.ref, referenceRef);
      item.needsAttachMove = false;
      item.skipNextEnqueue = true;
    }
    referenceRef = item.ref;
  }
  state.hasAttachedMoves = false;
}

function findNextAttachedItem(
  state: ETListState,
  cellIndex: number,
): ETListItemRecord | null {
  for (let index = cellIndex + 1; index < state.items.length; index += 1) {
    const item = state.items[index]!;
    if (item.attached) {
      return item;
    }
  }
  return null;
}

function markPendingListUpdate(
  uid: number,
  state: ETListState,
): PendingETListUpdate {
  let pendingUpdate = pendingListUpdates.get(uid);
  if (!pendingUpdate) {
    pendingUpdate = {
      state,
      beforeItems: state.items.slice(),
      beforeIndexByUid: createIndexByUid(state.items),
      removeUids: new Set(),
      insertUids: new Set(),
    };
    pendingListUpdates.set(uid, pendingUpdate);
  }
  return pendingUpdate;
}

function createIndexByUid(items: ETListItemRecord[]): Map<number, number> {
  const indexByUid = new Map<number, number>();
  for (let index = 0; index < items.length; index += 1) {
    indexByUid.set(items[index]!.uid, index);
  }
  return indexByUid;
}

function findListItemIndexByUid(
  items: ETListItemRecord[],
  uid: number,
): number {
  for (let index = 0; index < items.length; index += 1) {
    if (items[index]!.uid === uid) {
      return index;
    }
  }
  return -1;
}

function refreshCallbackItemsBySign(state: ETListState): void {
  if (state.callbackItemBySign.size === 0) {
    return;
  }

  for (const [sign, item] of state.callbackItemBySign) {
    const nextIndex = findListItemIndexByUid(state.items, item.uid);
    if (nextIndex !== -1) {
      state.callbackItemBySign.set(sign, state.items[nextIndex]!);
    }
  }
}

function collectRecordedListUpdateInfo(
  pendingUpdate: PendingETListUpdate,
): ETListUpdateInfo {
  const { state, beforeItems, beforeIndexByUid, removeUids, insertUids } = pendingUpdate;
  const insertAction: ETListUpdateInfo['insertAction'] = [];
  const removeAction: number[] = [];
  const updateAction: ETListUpdateInfo['updateAction'] = [];
  for (let index = 0; index < beforeItems.length; index += 1) {
    const item = beforeItems[index]!;
    if (removeUids.has(item.uid)) {
      removeAction.push(index);
    }
  }

  for (let index = 0; index < state.items.length; index += 1) {
    const item = state.items[index]!;
    if (insertUids.has(item.uid)) {
      insertAction.push(toInsertAction(item, index));
      continue;
    }

    const beforeIndex = beforeIndexByUid.get(item.uid)!;
    const beforeItem = beforeItems[beforeIndex]!;
    if (
      beforeItem.templateKey !== item.templateKey
      || !isDirectOrDeepEqual(beforeItem.platformInfo, item.platformInfo)
    ) {
      updateAction.push({
        ...item.platformInfo,
        from: index,
        to: index,
        type: item.templateKey,
        flush: false,
      });
    }
  }

  return {
    insertAction,
    removeAction,
    updateAction,
  };
}

function toInsertAction(
  item: ETListItemRecord,
  position: number,
): ETListUpdateInfo['insertAction'][number] {
  return {
    position,
    type: item.templateKey,
    ...item.platformInfo,
  };
}
