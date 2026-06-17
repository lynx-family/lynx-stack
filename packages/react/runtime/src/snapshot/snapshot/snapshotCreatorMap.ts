// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

type SnapshotCreatorMap = Record<string, (uniqId: string) => string>;
export let snapshotCreatorMap: SnapshotCreatorMap = {};

export function setSnapshotCreatorMap(map: SnapshotCreatorMap): void {
  snapshotCreatorMap = map;
}
