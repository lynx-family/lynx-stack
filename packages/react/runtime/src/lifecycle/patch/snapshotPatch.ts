// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Defines the core patch operations for the snapshot system.
 * The patch operations are designed to be serializable and minimal, allowing
 * efficient transmission between threads and application to element tree.
 */

export const SnapshotOperation = {
  CreateElement: 0,
  InsertBefore: 1,
  RemoveChild: 2,
  SetAttribute: 3,
  SetAttributes: 4,

  DEV_ONLY_AddSnapshot: 100,
  DEV_ONLY_RegisterWorklet: 101,
} as const;

export const SnapshotOperationParams: Record<number, { name: string; params: string[] }> = /* @__PURE__ */ {
  [SnapshotOperation.CreateElement]: { name: 'CreateElement', params: ['type', /* string */ 'id' /* number */] },
  [SnapshotOperation.InsertBefore]: {
    name: 'InsertBefore',
    params: ['parentId', /* number */ 'childId', /* number */ 'beforeId' /* number | undefined */],
  },
  [SnapshotOperation.RemoveChild]: { name: 'RemoveChild', params: ['parentId', /* number */ 'childId' /* number */] },
  [SnapshotOperation.SetAttribute]: {
    name: 'SetAttribute',
    params: ['id', /* number */ 'dynamicPartIndex', /* number */ 'value' /* any */],
  },
  [SnapshotOperation.SetAttributes]: { name: 'SetAttributes', params: ['id', /* number */ 'values' /* any */] },
  [SnapshotOperation.DEV_ONLY_AddSnapshot]: {
    name: 'DEV_ONLY_AddSnapshot',
    params: [
      'uniqID', /* string */
      'snapshotCreator', /* string */
    ],
  },
  [SnapshotOperation.DEV_ONLY_RegisterWorklet]: {
    name: 'DEV_ONLY_RegisterWorklet',
    params: ['hash', /* string */ 'fnStr' /* string */],
  },
} as const;

export type SnapshotPatch = unknown[];

export let __globalSnapshotPatch: SnapshotPatch | undefined;

export function takeGlobalSnapshotPatch(): SnapshotPatch | undefined {
  if (__globalSnapshotPatch) {
    const list = __globalSnapshotPatch;
    __globalSnapshotPatch = [];
    return list;
  } else {
    return undefined;
  }
}

export function initGlobalSnapshotPatch(): void {
  __globalSnapshotPatch = [];
}

export function deinitGlobalSnapshotPatch(): void {
  __globalSnapshotPatch = undefined;
}
