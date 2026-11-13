// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  RuntimeAttributeSlotValue,
  RuntimeTypedElementAttributes,
  SerializableValue,
} from '../../protocol/types.js';

const COMPONENT_AT_INDEX_ATTR = 'component-at-index';
const COMPONENT_AT_INDEXES_ATTR = 'component-at-indexes';
const ENQUEUE_COMPONENT_ATTR = 'enqueue-component';

export type ETListItemPlatformInfo = Record<string, SerializableValue>;

interface ETListCallbacks {
  componentAtIndex: ComponentAtIndexCallback;
  componentAtIndexes: ComponentAtIndexesCallback;
  enqueueComponent: EnqueueComponentCallback;
}

export interface ETListState {
  // Stable ET handle of the typed list holder; filled when the native holder is
  // created and registered.
  listHandleId: number | null;
  // Typed list handle returned by native create. Native invokes list callbacks
  // with an ordinary materialized Element root, while ET slot APIs target the
  // ElementTemplateHandle holder.
  holderRef: ElementTemplateHandle | null;
  // Holder teardown keeps callbacks Snapshot-safe for late native calls.
  destroyed: boolean;
  // Keep stable JS references to callbacks stored weakly by native.
  callbacks: ETListCallbacks;
}

const listStateByUid = /* @__PURE__ */ new Map<number, ETListState>();

export function createElementTemplateListState(): ETListState {
  const state: ETListState = {
    listHandleId: null,
    holderRef: null,
    destroyed: false,
    callbacks: {
      componentAtIndex() {
        if (state.destroyed) {
          return -1;
        }
        // TODO: Notify item refs after native materialization.
        return -1;
      },
      componentAtIndexes() {
        if (state.destroyed) {
          return;
        }
        // TODO: Notify item refs after native batch materialization.
      },
      enqueueComponent() {
        if (state.destroyed) {
          return;
        }
        // TODO: Notify item refs after native recycling.
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

export function markElementTemplateListDestroyed(uid: number): void {
  const state = listStateByUid.get(uid);
  if (!state) {
    return;
  }
  state.destroyed = true;
  state.holderRef = null;
  listStateByUid.delete(uid);
}

export function destroyAllElementTemplateListStates(): void {
  for (const state of listStateByUid.values()) {
    state.destroyed = true;
    state.holderRef = null;
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
  const callbacks = state.callbacks;
  return {
    ...attributes,
    [COMPONENT_AT_INDEX_ATTR]: callbacks.componentAtIndex as unknown as RuntimeAttributeSlotValue,
    [COMPONENT_AT_INDEXES_ATTR]: callbacks.componentAtIndexes as unknown as RuntimeAttributeSlotValue,
    [ENQUEUE_COMPONENT_ATTR]: callbacks.enqueueComponent as unknown as RuntimeAttributeSlotValue,
  };
}
