// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Global state shared across modules to avoid circular dependencies
 */

import { getCurrentRootContext, onRootContextSwitch } from '../../../render-context.js';

// Storage lives on the current `RootContext`; this binding is an alias kept in
// sync on writes and on context switches.
export let globalBackgroundSnapshotInstancesToRemove: number[] = getCurrentRootContext().bgInstancesToRemove;

onRootContextSwitch(() => {
  globalBackgroundSnapshotInstancesToRemove = getCurrentRootContext().bgInstancesToRemove;
});

export function setGlobalBackgroundSnapshotInstancesToRemove(ids: number[]): void {
  getCurrentRootContext().bgInstancesToRemove = ids;
  globalBackgroundSnapshotInstancesToRemove = ids;
}
