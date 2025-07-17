// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ListUpdateInfo } from './listUpdateInfo.js';

export const __pendingListUpdates = {
  values: {} as Record<number, ListUpdateInfo>,
  clear(id: number): void {
    delete this.values[id];
  },
  clearAttachedLists(): void {
    Object.values(this.values)
      .map(update => update.getAttachedListId())
      .filter(id => id !== undefined)
      .forEach(id => this.clear(id));
  },
  flush(): void {
    Object.values(this.values)
      .map(update => update.flush())
      .filter(id => id !== undefined)
      .forEach(id => this.clear(id));
  },
  flushWithId(id: number): void {
    if (this.values[id]?.flush()) {
      this.clear(id);
    }
  },
};
