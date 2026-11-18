// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  RuntimeAttributeSlotValue,
  RuntimeTypedElementAttributes,
  SerializableValue,
} from '../../protocol/types.js';
import {
  applyPendingMainThreadRefAttachments,
  attachMainThreadDynamicAttrRefsForSubtree,
  detachMainThreadDynamicAttrRefsForHandleIds,
  prepareSpreadAttrSlotForNative,
  runWithEomFlushSuppressed,
} from '../template/main-thread-dynamic-attr-state.js';
import type { MainThreadDynamicAttrSubtreeHandle } from '../template/main-thread-dynamic-attr-state.js';
import { elementTemplateRegistry } from '../template/registry.js';

const COMPONENT_AT_INDEX_ATTR = 'component-at-index';
const ENQUEUE_COMPONENT_ATTR = 'enqueue-component';

export type ETListItemPlatformInfo = Record<string, SerializableValue>;

export type ETListComponentAtIndexCallback = (
  listHandleId: number,
  itemHandleId: number,
) => void;

export type ETListEnqueueComponentCallback = (
  listHandleId: number,
  itemHandleId: number,
) => void;

interface ETListCallbacks {
  componentAtIndex: ETListComponentAtIndexCallback;
  enqueueComponent: ETListEnqueueComponentCallback;
}

export interface ETListState {
  // Stable ET handle of the typed list holder; filled when the native holder is
  // created and registered.
  listHandleId: number | null;
  // Typed list handle returned by native create.
  holderRef: ElementTemplateHandle | null;
  // Holder teardown keeps callbacks Snapshot-safe for late native calls.
  destroyed: boolean;
  // Logical item UIDs currently materialized and bound to a native list cell.
  mountedItemUids: Set<number>;
  // Candidate MTRef subtree handle IDs keyed by direct logical item UID.
  itemSubtreeHandleIds: Map<number, readonly number[]>;
  // Keep stable JS references to callbacks stored weakly by native.
  callbacks: ETListCallbacks;
}

const listStateByUid = /* @__PURE__ */ new Map<number, ETListState>();

function resolveLiveSubtreeHandles(
  handleIds: readonly number[],
): MainThreadDynamicAttrSubtreeHandle[] {
  const handles: MainThreadDynamicAttrSubtreeHandle[] = [];
  for (let index = 0; index < handleIds.length; index += 1) {
    const uid = handleIds[index]!;
    const ref = elementTemplateRegistry.get(uid);
    if (ref) {
      handles.push({ uid, ref });
    }
  }
  return handles;
}

export function createElementTemplateListState(
  initialItemSubtreeHandleIds?: Map<number, readonly number[]>,
): ETListState {
  const state: ETListState = {
    listHandleId: null,
    holderRef: null,
    destroyed: false,
    mountedItemUids: new Set(),
    itemSubtreeHandleIds: initialItemSubtreeHandleIds ?? new Map<number, readonly number[]>(),
    callbacks: {
      componentAtIndex(_listUid: number, itemUid: number) {
        if (state.destroyed) {
          return;
        }
        state.mountedItemUids.add(itemUid);
        const subtreeHandleIds = state.itemSubtreeHandleIds.get(itemUid);
        if (!subtreeHandleIds) {
          return;
        }
        const subtreeHandles = resolveLiveSubtreeHandles(subtreeHandleIds);
        if (subtreeHandles.length === 0) {
          return;
        }
        // Native ListElementTemplateInstance::ComponentAtIndex flushes the item
        // immediately after CallLepusMethod returns; suppress EOM microtask
        // auto-flush so ref style/attribute mutations join that single flush.
        runWithEomFlushSuppressed(() => {
          attachMainThreadDynamicAttrRefsForSubtree(subtreeHandles);
          applyPendingMainThreadRefAttachments();
        });
      },
      enqueueComponent(_listUid: number, itemUid: number) {
        if (!state.mountedItemUids.delete(itemUid)) {
          return;
        }
        const subtreeHandleIds = state.itemSubtreeHandleIds.get(itemUid);
        if (!subtreeHandleIds) {
          return;
        }
        detachMainThreadDynamicAttrRefsForHandleIds(subtreeHandleIds);
      },
    },
  };
  return state;
}

export function registerElementTemplateListState(
  uid: number,
  state: ETListState,
  holderRef: ElementTemplateHandle,
): void {
  state.listHandleId = uid;
  state.holderRef = holderRef;
  listStateByUid.set(uid, state);
}

export function updateElementTemplateListItemSubtreeHandles(
  listUid: number,
  itemUid: number,
  nextSubtreeHandles: readonly MainThreadDynamicAttrSubtreeHandle[],
): void {
  const state = listStateByUid.get(listUid);
  if (!state) {
    return;
  }
  if (nextSubtreeHandles.length === 0) {
    state.itemSubtreeHandleIds.delete(itemUid);
    return;
  }
  const nextSubtreeHandleIds = nextSubtreeHandles.map(handle => handle.uid);
  state.itemSubtreeHandleIds.set(itemUid, nextSubtreeHandleIds);
  if (state.mountedItemUids.has(itemUid)) {
    attachMainThreadDynamicAttrRefsForSubtree(nextSubtreeHandles);
  }
}

export function removeElementTemplateListItem(
  listUid: number,
  itemUid: number,
): void {
  const state = listStateByUid.get(listUid);
  if (!state) {
    return;
  }
  state.mountedItemUids.delete(itemUid);
  state.itemSubtreeHandleIds.delete(itemUid);
}

export function markElementTemplateListDestroyed(uid: number): void {
  const state = listStateByUid.get(uid);
  if (!state) {
    return;
  }
  state.destroyed = true;
  state.holderRef = null;
  state.mountedItemUids.clear();
  state.itemSubtreeHandleIds.clear();
  listStateByUid.delete(uid);
}

export function destroyAllElementTemplateListStates(): void {
  for (const state of listStateByUid.values()) {
    state.destroyed = true;
    state.holderRef = null;
    state.mountedItemUids.clear();
    state.itemSubtreeHandleIds.clear();
  }
  listStateByUid.clear();
}

export function updateElementTemplateListAttributes(
  uid: number,
  attributes: RuntimeTypedElementAttributes | null | undefined,
): RuntimeTypedElementAttributes | null {
  const state = listStateByUid.get(uid);
  if (!state) {
    return null;
  }
  return composeElementTemplateListAttributes(attributes, state);
}

export function composeElementTemplateListAttributes(
  attributes: RuntimeTypedElementAttributes | null | undefined,
  state: ETListState,
): RuntimeTypedElementAttributes {
  const nativeSpread = prepareSpreadAttrSlotForNative(attributes) as RuntimeTypedElementAttributes | null;
  const callbacks = state.callbacks;
  return {
    ...nativeSpread,
    [COMPONENT_AT_INDEX_ATTR]: callbacks.componentAtIndex as unknown as RuntimeAttributeSlotValue,
    [ENQUEUE_COMPONENT_ATTR]: callbacks.enqueueComponent as unknown as RuntimeAttributeSlotValue,
  };
}
