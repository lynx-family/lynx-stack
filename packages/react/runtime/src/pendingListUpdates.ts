// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ListUpdateInfo } from './listUpdateInfo.js';

export const __pendingListUpdates = {
  values: {} as Record<number, ListUpdateInfo> | null,
  clear(): void {
    this.values = {};
  },
  flush(): void {
    if (this.values) {
      Object.values(this.values).forEach(update => {
        update.flush();
      });
      this.clear();
    }
  },
  runWithoutUpdates(cb: () => void): void {
    const old = this.values;
    this.values = null as unknown as Record<number, ListUpdateInfo>;
    try {
      cb();
    } finally {
      this.values = old;
    }
  },
};
