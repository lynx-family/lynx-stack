// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Utility functions for snapshot system.
 */
import { CLONE_SNAPSHOT, COMPILED_SNAPSHOT } from './constants.js';
import type { WithChildren } from './types.js';

/**
 * Generates a unique ID for a snapshot entry by combining the entry name and unique ID.
 */
export function entryUniqID(uniqID: string, entryName?: string): string {
  return entryName ? `${entryName}:${uniqID}` : uniqID;
}

/**
 * Traverses a snapshot instance tree and calls the callback for each node.
 */
export function traverseSnapshotInstance<I extends WithChildren>(
  si: I,
  callback: (si: I) => void,
): void {
  // Walk the sibling chain directly instead of materializing a `childNodes`
  // array per node. The callback may detach the visited node from its parent
  // and siblings, so both the first child and each next sibling are captured
  // before the corresponding callback can run.
  let child = (si as unknown as { __firstChild: I | null }).__firstChild;
  callback(si);
  while (child) {
    const next = (child as unknown as { __nextSibling: I | null }).__nextSibling;
    traverseSnapshotInstance(child, callback);
    child = next;
  }
}

export const isCompiledSnapshot: (type: string) => boolean = (type: string) => type.includes(COMPILED_SNAPSHOT);

export const isCloneSnapshot: (type: string) => boolean = (type: string) => type.startsWith(`${CLONE_SNAPSHOT}_`);

export function getCloneSnapshotInfo(type: string): { originalType: string; cloneSpreadIndex: number } | undefined {
  // Format: `${CLONE_SNAPSHOT}_${cloneSpreadIndex}_${originalType}`.
  const match = new RegExp(`^${CLONE_SNAPSHOT}_(0|[1-9]\\d*)_(.+)$`).exec(type);
  if (!match) {
    return undefined;
  }

  const cloneSpreadIndexString = match[1]!;
  const cloneSpreadIndex = Number(cloneSpreadIndexString);
  const originalType = match[2]!;
  if (!isCompiledSnapshot(originalType)) {
    return undefined;
  }
  return { originalType, cloneSpreadIndex };
}

export function getCloneSnapshotType(type: string, cloneSpreadIndex: number): string {
  return isCloneSnapshot(type) ? type : `${CLONE_SNAPSHOT}_${cloneSpreadIndex}_${type}`;
}
