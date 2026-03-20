// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Extensible patch handler registry.
 * Allows external modules (e.g., MTC runtime) to register custom patch
 * operation handlers without modifying the core snapshotPatchApply switch.
 */

import type { SnapshotPatch } from './snapshotPatch.js';

type PatchHandler = (patch: SnapshotPatch, i: number) => number;

const registry: Map<number, PatchHandler> = new Map<number, PatchHandler>();

/**
 * Register a handler for a custom patch operation code.
 * Returns an unregister function.
 */
export function registerPatchHandler(
  op: number,
  handler: PatchHandler,
): () => void {
  registry.set(op, handler);
  return () => {
    registry.delete(op);
  };
}

export { registry as patchHandlerRegistry };
