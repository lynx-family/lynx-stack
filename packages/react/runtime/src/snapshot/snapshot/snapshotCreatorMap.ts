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

/**
 * One-shot tokens recording that the main thread's creator for a `uniqID` is the
 * one we serialized over via `DEV_ONLY_AddSnapshot` — and therefore still carries
 * the `globDynamicComponentEntry` placeholder and round-trips through
 * `Function.prototype.toString`.
 *
 * `DEV_ONLY_SetSnapshotEntryName` rewrites that placeholder, so it is only
 * meaningful while this invariant holds. A lazy bundle loaded *during first-screen
 * direct render* never sends `DEV_ONLY_AddSnapshot` (`__globalSnapshotPatch` does
 * not exist before hydration), yet its `createSnapshot()` call happens after
 * hydration — without this token the background thread would emit an orphan
 * `DEV_ONLY_SetSnapshotEntryName` against the creator compiled into the main
 * thread's own chunk.
 *
 * Only populated in `__DEV__ && __JS__`.
 */
export const devOnlySentSnapshots: Set<string> | undefined = (__DEV__ && __JS__) ? new Set() : undefined;
