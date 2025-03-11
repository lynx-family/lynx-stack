// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export const enum SnapshotOperation {
  CreateElement,
  InsertBefore,
  RemoveChild,
  SetAttribute,
  SetAttributes,

  DEV_ONLY_AddSnapshot = 100,
  DEV_ONLY_RegisterWorklet = 101,
}

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

export type SnapshotPatch = any[];

export let __globalSnapshotPatch: any;

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
