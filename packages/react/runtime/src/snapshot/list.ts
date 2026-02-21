// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { hydrate } from '../hydrate.js';
import { componentAtIndexFactory, enqueueComponentFactory, gRecycleMap, gSignMap } from '../list.js';
import type { SnapshotInstance } from '../snapshot.js';

const destroyLifetimeHandlerMap = new Map<number, () => void>();

export function snapshotCreateList(
  pageId: number,
  _ctx: SnapshotInstance,
  _expIndex: number,
): FiberElement {
  const signMap = new Map<number, SnapshotInstance>();
  const recycleMap = new Map<string, Map<number, SnapshotInstance>>();
  const [componentAtIndex, componentAtIndexes] = componentAtIndexFactory([], hydrate);
  const list = __CreateList(
    pageId,
    componentAtIndex,
    enqueueComponentFactory(),
    {},
    componentAtIndexes,
  );
  const listID = __GetElementUniqueID(list);

  if (typeof lynx !== 'undefined' && typeof lynx.getNative === 'function') {
    const cb = () => {
      __UpdateListCallbacks(list, null, null, null);
      destroyLifetimeHandlerMap.delete(listID);
    };
    lynx.getNative()?.addEventListener('__DestroyLifetime', cb);
    destroyLifetimeHandlerMap.set(listID, cb);
  }

  gSignMap[listID] = signMap;
  gRecycleMap[listID] = recycleMap;
  return list;
}

export function snapshotDestroyList(si: SnapshotInstance): void {
  const [, elementIndex] = si.__snapshot_def.slot[0]!;
  const list = si.__elements![elementIndex]!;
  const listID = __GetElementUniqueID(list);

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
}
