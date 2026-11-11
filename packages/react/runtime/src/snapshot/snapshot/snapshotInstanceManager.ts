// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { SnapshotInstance } from './snapshot.js';
import { cardLifetime } from '../../core/card-lifetime.js';
import { clearSnapshotVNodeSource } from '../debug/vnodeSource.js';

interface SnapshotInstanceManager {
  nextId: number;
  values: Map<number, SnapshotInstance>;
  clear(): void;
}

function clear(this: SnapshotInstanceManager): void {
  // not resetting `nextId` to prevent id collision
  this.values.clear();
  if (__DEV__) {
    clearSnapshotVNodeSource();
  }
}

export const snapshotInstanceManager: SnapshotInstanceManager = /*#__PURE__*/ cardLifetime(
  'snapshotInstanceManager',
  () => ({ nextId: 0, values: new Map<number, SnapshotInstance>(), clear }),
);

// Rebound so that it clears the debug state of the current entry.
snapshotInstanceManager.clear = clear;
