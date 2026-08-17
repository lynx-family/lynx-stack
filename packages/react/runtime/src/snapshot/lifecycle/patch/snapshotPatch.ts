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
  nodesRefInsertBefore: 5,
  nodesRefRemoveChild: 6,
  CreateElementByTypeIndex: 7,

  DEV_ONLY_AddSnapshot: 100,
  DEV_ONLY_RegisterWorklet: 101,
  DEV_ONLY_SetSnapshotEntryName: 102,
} as const;

export const SnapshotOperationParams: Record<number, { name: string; params: string[] }> = /* @__PURE__ */ {
  [SnapshotOperation.CreateElement]: {
    name: 'CreateElement',
    params: ['type', /* string */ 'id' /* number */],
  },
  [SnapshotOperation.InsertBefore]: {
    name: 'InsertBefore',
    params: [
      'parentId',
      /* number */ 'childId',
      /* number */ 'beforeId',
      /* number | undefined */ 'slotIndex', /* number | undefined */
    ],
  },
  [SnapshotOperation.RemoveChild]: { name: 'RemoveChild', params: ['parentId', /* number */ 'childId' /* number */] },
  [SnapshotOperation.SetAttribute]: {
    name: 'SetAttribute',
    params: ['id', /* number */ 'dynamicPartIndex', /* number */ 'value' /* any */],
  },
  [SnapshotOperation.SetAttributes]: { name: 'SetAttributes', params: ['id', /* number */ 'values' /* any */] },
  [SnapshotOperation.nodesRefInsertBefore]: {
    name: 'nodesRefInsertBefore',
    params: [
      'identifier', /* string — CSS selector */
      'childId', /* number */
      'beforeId', /* number | undefined */
    ],
  },
  [SnapshotOperation.nodesRefRemoveChild]: {
    name: 'nodesRefRemoveChild',
    params: [
      'identifier', /* string — CSS selector */
      'childId', /* number */
    ],
  },
  [SnapshotOperation.CreateElementByTypeIndex]: {
    name: 'CreateElementByTypeIndex',
    params: ['typeIndex', /* number */ 'id' /* number */],
  },
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
  [SnapshotOperation.DEV_ONLY_SetSnapshotEntryName]: {
    name: 'DEV_ONLY_SetSnapshotEntryName',
    params: ['uniqID', /* string */ 'entryName' /* string */],
  },
} as const;

export type SnapshotPatch = unknown[];

export let __globalSnapshotPatch: SnapshotPatch | undefined;
let globalSnapshotTypeIndexes:
  | Map<string | null, number>
  | undefined;
let globalSnapshotFirstCreateType: string | null | undefined;
let globalSnapshotSecondCreateType: string | null | undefined;
let globalSnapshotCreateCount = 0;

export function pushCreateElementOperation(
  type: string | null,
  id: number,
): void {
  if (!__globalSnapshotPatch) {
    return;
  }
  if (globalSnapshotCreateCount === 0) {
    globalSnapshotFirstCreateType = type;
    globalSnapshotCreateCount = 1;
    __globalSnapshotPatch.push(SnapshotOperation.CreateElement, type, id);
    return;
  }
  if (globalSnapshotCreateCount === 1) {
    globalSnapshotSecondCreateType = type;
    globalSnapshotCreateCount = 2;
    __globalSnapshotPatch.push(SnapshotOperation.CreateElement, type, id);
    return;
  }
  if (!globalSnapshotTypeIndexes) {
    globalSnapshotTypeIndexes = new Map();
    globalSnapshotTypeIndexes.set(globalSnapshotFirstCreateType!, 0);
    if (
      globalSnapshotSecondCreateType !== globalSnapshotFirstCreateType
    ) {
      globalSnapshotTypeIndexes.set(globalSnapshotSecondCreateType!, 1);
    }
  }
  const typeIndex = globalSnapshotTypeIndexes.get(type);
  if (typeIndex === undefined) {
    globalSnapshotTypeIndexes.set(type, globalSnapshotTypeIndexes.size);
    __globalSnapshotPatch.push(SnapshotOperation.CreateElement, type, id);
  } else {
    __globalSnapshotPatch.push(
      SnapshotOperation.CreateElementByTypeIndex,
      typeIndex,
      id,
    );
  }
  globalSnapshotCreateCount++;
}

export function takeGlobalSnapshotPatch(): SnapshotPatch | undefined {
  if (__globalSnapshotPatch) {
    const list = __globalSnapshotPatch;
    __globalSnapshotPatch = [];
    globalSnapshotTypeIndexes = undefined;
    globalSnapshotFirstCreateType = undefined;
    globalSnapshotSecondCreateType = undefined;
    globalSnapshotCreateCount = 0;
    return list;
  } else {
    return undefined;
  }
}

export function initGlobalSnapshotPatch(): void {
  __globalSnapshotPatch = [];
  globalSnapshotTypeIndexes = undefined;
  globalSnapshotFirstCreateType = undefined;
  globalSnapshotSecondCreateType = undefined;
  globalSnapshotCreateCount = 0;
}

export function deinitGlobalSnapshotPatch(): void {
  __globalSnapshotPatch = undefined;
  globalSnapshotTypeIndexes = undefined;
  globalSnapshotFirstCreateType = undefined;
  globalSnapshotSecondCreateType = undefined;
  globalSnapshotCreateCount = 0;
}
