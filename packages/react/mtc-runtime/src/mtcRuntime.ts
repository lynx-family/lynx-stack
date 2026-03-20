// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * MTC Runtime initialization.
 *
 * Registers patch handlers for MTC operations (Mount, Update, Unmount)
 * using the extensible patch handler registry from PR 1.
 * Hooks into the existing destroyTasks lifecycle for cleanup.
 */

import { cleanupAllInstances, handleMount, handleUnmount, handleUpdate, registerMTCComponent } from './renderer.js';

// MTC operation codes — must match SnapshotOperation in snapshotPatch.ts
const MtcMount = 10;
const MtcUpdate = 11;
const MtcUnmount = 12;

/**
 * Initialize the MTC runtime.
 * Registers patch handlers and sets up cleanup.
 *
 * @param registerPatchHandler - The registry function from @lynx-js/react/internal
 * @param snapshotInstanceValues - The snapshot instance manager values map
 * @param destroyTasks - The destroy tasks array for lifecycle cleanup
 */
export function initMtcRuntime(
  registerPatchHandler: (op: number, handler: (patch: unknown[], i: number) => number) => () => void,
  snapshotInstanceValues: Map<number, { __element_root?: unknown }>,
  destroyTasks: (() => void)[],
): void {
  const unregMount = registerPatchHandler(
    MtcMount,
    (patch, i) => handleMount(patch, i, snapshotInstanceValues),
  );
  const unregUpdate = registerPatchHandler(
    MtcUpdate,
    (patch, i) => handleUpdate(patch, i, snapshotInstanceValues),
  );
  const unregUnmount = registerPatchHandler(
    MtcUnmount,
    (patch, i) => handleUnmount(patch, i, snapshotInstanceValues),
  );

  // Register page-level cleanup
  destroyTasks.push(() => {
    cleanupAllInstances();
    unregMount();
    unregUpdate();
    unregUnmount();
  });
}

export { registerMTCComponent };
