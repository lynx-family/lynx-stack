// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Global state shared across modules to avoid circular dependencies
 */

import { onRootContextSwitch } from '../../../render-context.js';

/**
 * List of background snapshot instances to remove during commit phase
 */
export let globalBackgroundSnapshotInstancesToRemove: number[] = [];

if (typeof __LYNX_GROUP_MODULE_SHARING__ !== 'undefined' && __LYNX_GROUP_MODULE_SHARING__) {
  onRootContextSwitch(
    (ctx) => ctx.bgInstancesToRemove = globalBackgroundSnapshotInstancesToRemove,
    (ctx) => globalBackgroundSnapshotInstancesToRemove = ctx.bgInstancesToRemove,
  );
}

export function setGlobalBackgroundSnapshotInstancesToRemove(ids: number[]): void {
  globalBackgroundSnapshotInstancesToRemove = ids;
}
