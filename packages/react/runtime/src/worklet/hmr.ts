// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// import { __globalSnapshotPatch } from '../lifecycle/patch/snapshotPatch.js';

// const workletHashSet: Set<string> = /* @__PURE__ */ new Set();

/* v8 ignore start */
/**
 * @internal
 */
// disable hmr until bugs are fixed
// TODO: re-enable hmr or change a way to impl it; also need to fix the test case DEV_ONLY_RegisterWorklet
function registerWorkletOnBackground(_type: string, _hash: string, _fn: Function) {
  // if (workletHashSet.has(hash)) {
  //   return;
  // }
  // workletHashSet.add(hash);
  // if (__globalSnapshotPatch) {
  //   __globalSnapshotPatch.push(
  //     SnapshotOperation.DEV_ONLY_RegisterWorklet,
  //     hash,
  //     // We use `Function.prototype.toString` to serialize the function for Lepus.
  //     fn.toString(),
  //   );
  // }
}
/* v8 ignore stop */

export { registerWorkletOnBackground };
