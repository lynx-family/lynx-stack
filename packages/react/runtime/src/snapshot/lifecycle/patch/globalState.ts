// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Global state shared across modules to avoid circular dependencies
 */

/**
 * List of background snapshot instances to remove during commit phase
 */
export let globalBackgroundSnapshotInstancesToRemove: number[] = [];

export function setGlobalBackgroundSnapshotInstancesToRemove(ids: number[]): void {
  globalBackgroundSnapshotInstancesToRemove = ids;
}
