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

// Operation format definitions:
//
// [opcode: SnapshotOperation.CreateElement, type: string, id: number]
// [opcode: SnapshotOperation.InsertBefore, parentId: number, id: number, beforeId: number | undefined]
// [opcode: SnapshotOperation.RemoveChild, parentId: number, childId: number]
// [opcode: SnapshotOperation.SetAttribute, id: number, dynamicPartIndex: number, value: any]
// [opcode: SnapshotOperation.SetAttributes, id: number, value: any]
// [
//   opcode: SnapshotOperation.DEV_ONLY_AddSnapshot,
//   uniqID: string,
//   create: string,
//   update: string[],
//   /** The same as Snapshot['slot'] */
//   slot: [DynamicPartType, number][],
//   cssId: number | undefined,
//   entryName: string | undefined
// ]
// [
//   opcode: SnapshotOperation.DEV_ONLY_RegisterWorklet,
//   hash: string,
//   fn: string,
// ]

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
