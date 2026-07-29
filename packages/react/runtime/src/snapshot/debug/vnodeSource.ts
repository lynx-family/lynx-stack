// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const snapshotVNodeSourceMap: Map<number, string> = /*#__PURE__*/ new Map();

export function setSnapshotVNodeSource(id: number, source: string): void {
  snapshotVNodeSourceMap.set(id, source);
}

export function moveSnapshotVNodeSource(oldId: number, newId: number): void {
  if (oldId === newId) {
    return;
  }
  const source = snapshotVNodeSourceMap.get(oldId);
  if (source) {
    snapshotVNodeSourceMap.set(newId, source);
    snapshotVNodeSourceMap.delete(oldId);
  }
}

export function getSnapshotVNodeSource(id: number): string | undefined {
  return snapshotVNodeSourceMap.get(id);
}

export function clearSnapshotVNodeSource(): void {
  snapshotVNodeSourceMap.clear();
}
