// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

let lastIdBG = 0;
let lastIdMT = 0;

/** @internal */
export function allocateMainThreadRefId(): number {
  return __JS__ ? ++lastIdBG : --lastIdMT;
}

/** @internal */
export function clearMainThreadRefIdsForTesting(): void {
  lastIdBG = lastIdMT = 0;
}
