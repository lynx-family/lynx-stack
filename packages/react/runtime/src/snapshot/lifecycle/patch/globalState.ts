// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Global state shared across modules to avoid circular dependencies
 */

/**
 * List of background snapshot instances to remove during commit phase
 */
import { registerContextSlot } from '../../../root-context.js';

export let globalBackgroundSnapshotInstancesToRemove: number[] = [];

export function setGlobalBackgroundSnapshotInstancesToRemove(ids: number[]): void {
  globalBackgroundSnapshotInstancesToRemove = ids;
}

if (typeof __MULTI_PAGE__ !== 'undefined' && __MULTI_PAGE__) {
  registerContextSlot({
    id: 'bgInstancesToRemove',
    init: () => [],
    save(bag) {
      bag['bgInstancesToRemove'] = globalBackgroundSnapshotInstancesToRemove;
    },
    load(bag) {
      globalBackgroundSnapshotInstancesToRemove = bag['bgInstancesToRemove'] as number[];
    },
  });
}
