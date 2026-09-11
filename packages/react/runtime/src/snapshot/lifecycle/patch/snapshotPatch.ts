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
  SetAttributeRun: 7,

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
    params: ['id', /* number */ 'dynamicPartIndex', /* number | string */ 'value' /* any */],
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
  [SnapshotOperation.SetAttributeRun]: {
    name: 'SetAttributeRun',
    params: [
      'dynamicPartIndex', /* number | string */
      'firstId', /* number */
      'idStep', /* number */
      'values', /* any[] */
    ],
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

export const SET_ATTRIBUTE_RUN_MIN_SIZE = 16;

let setAttributeRunOperationIndex = 0;
let setAttributeRunKey: number | string | undefined;
let setAttributeRunFirstId = 0;
let setAttributeRunPreviousId = 0;
let setAttributeRunStep: number | undefined;
let setAttributeRunLength = 0;

function isBatchableAttributeValue(value: unknown): boolean {
  return value === null
    || value === undefined
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean';
}

function resetSetAttributeRun(): void {
  setAttributeRunKey = undefined;
  setAttributeRunStep = undefined;
  setAttributeRunLength = 0;
}

export function pushSetAttributeOperation(
  id: number,
  dynamicPartIndex: number | string,
  value: unknown,
): void {
  const patch = __globalSnapshotPatch!;
  if (
    !Number.isSafeInteger(id)
    || (
      typeof dynamicPartIndex !== 'string'
      && !Number.isSafeInteger(dynamicPartIndex)
    )
    || !isBatchableAttributeValue(value)
  ) {
    resetSetAttributeRun();
    patch.push(
      SnapshotOperation.SetAttribute,
      id,
      dynamicPartIndex,
      value,
    );
    return;
  }

  const expectedPatchLength = setAttributeRunKey === undefined
    ? -1
    : setAttributeRunOperationIndex + (
      setAttributeRunLength < SET_ATTRIBUTE_RUN_MIN_SIZE
        ? setAttributeRunLength * 4
        : 5
    );
  const step = setAttributeRunStep ?? id - setAttributeRunFirstId;
  if (
    setAttributeRunKey === dynamicPartIndex
    && (
      setAttributeRunLength === 1
      || id - setAttributeRunPreviousId === step
    )
    && Number.isSafeInteger(step)
    && patch.length === expectedPatchLength
  ) {
    setAttributeRunPreviousId = id;
    setAttributeRunStep = step;
    setAttributeRunLength++;
    if (setAttributeRunLength < SET_ATTRIBUTE_RUN_MIN_SIZE) {
      patch.push(
        SnapshotOperation.SetAttribute,
        id,
        dynamicPartIndex,
        value,
      );
    } else if (setAttributeRunLength === SET_ATTRIBUTE_RUN_MIN_SIZE) {
      const values: unknown[] = [];
      for (
        let index = setAttributeRunOperationIndex + 3;
        index < patch.length;
        index += 4
      ) {
        values.push(patch[index]);
      }
      values.push(value);
      patch.splice(
        setAttributeRunOperationIndex,
        (SET_ATTRIBUTE_RUN_MIN_SIZE - 1) * 4,
        SnapshotOperation.SetAttributeRun,
        dynamicPartIndex,
        setAttributeRunFirstId,
        step,
        values,
      );
    } else {
      (patch[setAttributeRunOperationIndex + 4] as unknown[]).push(value);
    }
    return;
  }

  setAttributeRunOperationIndex = patch.length;
  setAttributeRunKey = dynamicPartIndex;
  setAttributeRunFirstId = id;
  setAttributeRunPreviousId = id;
  setAttributeRunStep = undefined;
  setAttributeRunLength = 1;
  patch.push(
    SnapshotOperation.SetAttribute,
    id,
    dynamicPartIndex,
    value,
  );
}

export let __globalSnapshotPatch: SnapshotPatch | undefined;

export function takeGlobalSnapshotPatch(): SnapshotPatch | undefined {
  if (__globalSnapshotPatch) {
    const list = __globalSnapshotPatch;
    __globalSnapshotPatch = [];
    resetSetAttributeRun();
    return list;
  } else {
    return undefined;
  }
}

export function initGlobalSnapshotPatch(): void {
  __globalSnapshotPatch = [];
  resetSetAttributeRun();
}

export function deinitGlobalSnapshotPatch(): void {
  __globalSnapshotPatch = undefined;
  resetSetAttributeRun();
}
