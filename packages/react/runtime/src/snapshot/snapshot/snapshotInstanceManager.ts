// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { SnapshotInstance } from './snapshot.js';
import { clearSnapshotVNodeSource } from '../debug/vnodeSource.js';

// Old removal tasks can outlive an entry re-evaluation, so IDs must not restart.
const nextIdKey = Symbol.for('__LYNX_SNAPSHOT_NEXT_ID__');
const lynxSymbols = lynx as unknown as Record<symbol, number>;

lynxSymbols[nextIdKey] ??= 0;

export const snapshotInstanceManager: {
  nextId: number;
  values: Map<number, SnapshotInstance>;
  clear(): void;
} = {
  get nextId() {
    return lynxSymbols[nextIdKey]!;
  },
  set nextId(value: number) {
    lynxSymbols[nextIdKey] = value;
  },
  values: /* @__PURE__ */ new Map<number, SnapshotInstance>(),
  clear() {
    // not resetting `nextId` to prevent id collision
    this.values.clear();
    if (__DEV__) {
      clearSnapshotVNodeSource();
    }
  },
};
