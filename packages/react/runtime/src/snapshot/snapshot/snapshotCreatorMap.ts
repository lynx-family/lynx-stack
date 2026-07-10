// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The internal-runtime namespace passed to a snapshot creator as its second
 * argument. Dev creators are stringified for cross-thread HMR
 * (`DEV_ONLY_AddSnapshot`), so they must not capture module bindings — the
 * caller injects the runtime instead. Production creators close over their
 * own module's runtime import (statically tree-shakeable) and ignore it.
 */
export type SnapshotCreatorRuntime = typeof import('../../internal.js');

export type SnapshotCreator = (uniqId: string, runtime?: SnapshotCreatorRuntime) => string;

type SnapshotCreatorMap = Record<string, SnapshotCreator>;
export let snapshotCreatorMap: SnapshotCreatorMap = {};

export function setSnapshotCreatorMap(map: SnapshotCreatorMap): void {
  snapshotCreatorMap = map;
}

/**
 * Set only in `__DEV__` (by `internal.js` registering its own namespace), so
 * production keeps no reference to the full runtime namespace.
 */
export let snapshotCreatorRuntime: SnapshotCreatorRuntime | undefined;

export function setSnapshotCreatorRuntime(runtime: SnapshotCreatorRuntime): void {
  snapshotCreatorRuntime = runtime;
}
