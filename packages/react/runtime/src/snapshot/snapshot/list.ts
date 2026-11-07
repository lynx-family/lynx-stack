// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { traverseSnapshotInstance } from './utils.js';
import { cardLifetime } from '../../core/card-lifetime.js';
import { componentAtIndexFactory, enqueueComponentFactory, gRecycleMap, gSignMap } from '../list/list.js';
import {
  createNestedListState,
  destroyNestedListState,
  isCurrentNestedListOwner,
  transferNestedListState,
  updateNestedListChildren,
} from '../list/nativeState.js';
import { clearReuseTransitions } from '../list/reuseTransition.js';
import { hydrate } from '../renderToOpcodes/hydrate.js';
import type { SnapshotInstance } from '../snapshot/snapshot.js';

const destroyLifetimeHandlerMap = /*#__PURE__*/ cardLifetime(
  'listDestroyLifetimeHandlerMap',
  () => new Map<number, () => void>(),
);

export function snapshotCreateList(
  pageId: number,
  _ctx: SnapshotInstance,
  _expIndex: number,
): FiberElement {
  const signMap = new Map<number, SnapshotInstance>();
  const recycleMap = new Map<string, Map<number, SnapshotInstance>>();
  const children: SnapshotInstance[] = [];
  const [componentAtIndex, componentAtIndexes] = componentAtIndexFactory(children, hydrate);
  const list = __CreateList(
    pageId,
    componentAtIndex,
    enqueueComponentFactory(children),
    {},
    componentAtIndexes,
  );
  const listID = __GetElementUniqueID(list);
  snapshotInitializeList(_ctx, list, children);

  gSignMap[listID] = signMap;
  gRecycleMap[listID] = recycleMap;
  return list;
}

/** Share list state and page-lifetime setup between CSR and SSR adoption. */
export function snapshotInitializeList(
  owner: SnapshotInstance,
  list: FiberElement,
  children: readonly SnapshotInstance[],
): void {
  const listID = __GetElementUniqueID(list);
  createNestedListState(owner, list, children);
  if (!destroyLifetimeHandlerMap.has(listID) && typeof lynx !== 'undefined' && typeof lynx.getNative === 'function') {
    const cb = () => {
      // This is the owning page's main-thread lifetime boundary.
      clearReuseTransitions();
      destroyNestedListState(listID);
      __UpdateListCallbacks(list, null, null, null);
      destroyLifetimeHandlerMap.delete(listID);
    };
    lynx.getNative()?.addEventListener('__DestroyLifetime', cb);
    destroyLifetimeHandlerMap.set(listID, cb);
  }
}

export function snapshotDestroyList(si: SnapshotInstance, destroyed: Set<number> = new Set<number>()): void {
  const [, elementIndex] = si.__snapshot_def.slot[0]!;
  const list = si.__elements?.[elementIndex];
  // `takeElements` and hydration transfer the rendered elements to a new
  // SnapshotInstance while leaving the old instance tree available for
  // teardown. Only the instance that still owns the list element may clean up
  // its callbacks and recycling state.
  if (list === undefined || !isCurrentNestedListOwner(si, list)) {
    return;
  }
  const listID = __GetElementUniqueID(list);
  if (destroyed.has(listID)) return;
  destroyed.add(listID);
  const cached = new Set(gSignMap[listID]?.values());
  for (const pool of gRecycleMap[listID]?.values() ?? []) {
    for (const child of pool.values()) cached.add(child);
  }
  destroyNestedListState(listID);

  __UpdateListCallbacks(list, () => -1, () => {}, () => {});

  if (typeof lynx !== 'undefined' && typeof lynx.getNative === 'function') {
    const cb = destroyLifetimeHandlerMap.get(listID);
    if (cb) {
      lynx.getNative()?.removeEventListener('__DestroyLifetime', cb);
      destroyLifetimeHandlerMap.delete(listID);
    }
  }

  delete gSignMap[listID];
  delete gRecycleMap[listID];

  // Removed rows may exist only in the physical caches, outside the logical
  // child tree. Reuse the normal teardown path without removing native nodes
  // or unregistering snapshots still owned by React.
  for (const child of cached) {
    traverseSnapshotInstance(child, snapshot => {
      if (snapshot.__snapshot_def.isListHolder) snapshotDestroyList(snapshot, destroyed);
    });
  }
}

/** Transfer a retained list's callbacks and cell caches to its rendered clone. */
export function snapshotTransferListOwnership(before: SnapshotInstance, after: SnapshotInstance): void {
  const list = after.__elements![after.__snapshot_def.slot[0]![1]]!;
  transferNestedListState(after, list, true);
  const listID = __GetElementUniqueID(list);
  const signMap = gSignMap[listID];
  const recycleMap = gRecycleMap[listID];
  if (!signMap || !recycleMap) {
    // A destroyed list must not have its callbacks or caches reinstalled.
    return;
  }
  const oldChildren = before.childNodes;
  const children = after.childNodes;
  updateNestedListChildren(after, list, children);
  children.forEach((child, index) => {
    if (!child.__element_root) {
      return;
    }
    const sign = __GetElementUniqueID(child.__element_root);
    const oldChild = oldChildren[index]!;
    if (signMap.get(sign) === oldChild) {
      signMap.set(sign, child);
    }
    const key = child.type + (child.__listItemPlatformInfo?.['reuse-identifier'] ?? '');
    const pool = recycleMap.get(key);
    if (pool?.get(sign) === oldChild) {
      pool.set(sign, child);
    }
  });
  const [componentAtIndex, componentAtIndexes] = componentAtIndexFactory(children, hydrate);
  __UpdateListCallbacks(list, componentAtIndex, enqueueComponentFactory(children), componentAtIndexes);
}
