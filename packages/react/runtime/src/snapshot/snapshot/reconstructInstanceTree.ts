// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Walk a `BackgroundSnapshotInstance` subtree depth-first and emit the
 * `CreateElement` / `SetAttributes` / `InsertBefore` ops needed to rebuild
 * it on the main thread.
 *
 * Extracted into its own module so both `backgroundSnapshot.ts` (used by
 * lazy / Suspense reattach) and `portalsPending.ts` (used by portal
 * pre-hydrate replay) can share the helper without forming an import
 * cycle. The function only depends on the `BackgroundSnapshotInstance`
 * type — its concrete shape is supplied by callers — so we use
 * `import type` to keep the dependency type-only at runtime.
 */

import type { BackgroundSnapshotInstance } from './backgroundSnapshot.js';
import { SnapshotOperation, __globalSnapshotPatch } from '../lifecycle/patch/snapshotPatch.js';

export function reconstructInstanceTree(
  afters: BackgroundSnapshotInstance[],
  parentId?: number,
  targetId?: number,
): void {
  for (const child of afters) {
    const id = child.__id;
    __globalSnapshotPatch?.push(SnapshotOperation.CreateElement, child.type, id);
    const values = child.__values;
    if (values) {
      child.__values = undefined;
      child.setAttribute('values', values);
    }
    const extraProps = child.__extraProps;
    for (const key in extraProps) {
      child.setAttribute(key, extraProps[key]);
    }
    reconstructInstanceTree(child.childNodes, id);
    // Skip the parent link when `parentId` is `undefined` — used by portal,
    // where the topmost reconstructed node has no BSI parent (it is attached
    // to a NodesRef-resolved host element via `nodesRefInsertBefore`).
    if (parentId !== undefined) {
      __globalSnapshotPatch?.push(SnapshotOperation.InsertBefore, parentId, id, targetId, child.__slotIndex);
    }
  }
}
