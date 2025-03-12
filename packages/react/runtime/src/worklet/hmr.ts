// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { SnapshotOperation, __globalSnapshotPatch } from '../lifecycle/patch/snapshotPatch.js';

const workletHashSet: Set<string> = /* @__PURE__ */ new Set();

/**
 * @internal
 */
function registerWorkletOnBackground(_type: string, hash: string, fn: Function) {
  if (workletHashSet.has(hash)) {
    return;
  }
  workletHashSet.add(hash);
  if (__globalSnapshotPatch) {
    __globalSnapshotPatch.push(
      SnapshotOperation.DEV_ONLY_RegisterWorklet,
      hash,
      // We use `Function.prototype.toString` to serialize the function for Lepus.
      fn.toString(),
    );
  }
}

export { registerWorkletOnBackground };
