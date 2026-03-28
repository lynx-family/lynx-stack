// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { snapshotInstanceManager } from '../snapshot/snapshot.js';

function injectLepusMethods(): void {
  Object.assign(globalThis, {
    getUniqueIdListBySnapshotId,
    getSnapshotIdByUniqueId,
  });
}

/**
 * Get the list of `unique_id` of the fiber element by the SnapshotInstance `__id`.
 */
function getUniqueIdListBySnapshotId({ snapshotId }: { snapshotId: number }) {
  const si = snapshotInstanceManager.values.get(snapshotId);
  if (si?.__elements?.length) {
    const uniqueIdList = [];
    for (const element of si.__elements) {
      const uniqueId = __GetElementUniqueID(element);
      uniqueIdList.push(uniqueId);
    }
    return {
      uniqueIdList,
    };
  }
  return null;
}

/**
 * Get the SnapshotInstance `__id` of the fiber element by the `unique_id`.
 */
function getSnapshotIdByUniqueId({ uniqueId }: { uniqueId: number }) {
  for (const si of snapshotInstanceManager.values.values()) {
    if (si?.__elements?.length) {
      for (const element of si.__elements) {
        const unique_id = __GetElementUniqueID(element);
        if (unique_id === uniqueId) {
          return {
            snapshotId: si.__id,
          };
        }
      }
    }
  }
  return null;
}

/**
 * @internal
 */
export { injectLepusMethods };
