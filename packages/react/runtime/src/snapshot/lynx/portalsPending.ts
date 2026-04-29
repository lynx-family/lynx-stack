// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Portal-side queue + drain — extracted into its own module to avoid an
 * import cycle:
 *   - `portals.ts` (Portal component) writes into `pendingInsertBefore`
 *   - `backgroundSnapshot.ts` (hydrate) calls `clearPendingPortalInsertBefore`
 *
 * Splitting the queue out keeps `backgroundSnapshot.ts` from having to
 * import `portals.ts`.
 */

import type { NodesRef } from '@lynx-js/types';

import { serializeNodesRef } from './nodesRef.js';
import { SnapshotOperation, __globalSnapshotPatch } from '../lifecycle/patch/snapshotPatch.js';
import type { BackgroundSnapshotInstance } from '../snapshot/backgroundSnapshot.js';
import { reconstructInstanceTree } from '../snapshot/reconstructInstanceTree.js';

/**
 * Tuples of `(container, child, before)` queued by `Portal`'s pre-hydrate
 * `fakeRoot.insertBefore` — the global patch buffer is `undefined` before
 * hydrate, so the BSI constructor's `CreateElement` push and our
 * `nodesRefInsertBefore` push would both be silently dropped. We hold them
 * here and replay during `clearPendingPortalInsertBefore` (called from
 * `hydrate()` once the global buffer is initialized).
 */
export const pendingInsertBefore: unknown[] = [];

export const clearPendingPortalInsertBefore = (): void => {
  let i = 0;
  while (i < pendingInsertBefore.length) {
    const container = pendingInsertBefore[i++] as NodesRef;
    const child = pendingInsertBefore[i++] as BackgroundSnapshotInstance;
    const before = pendingInsertBefore[i++] as
      | BackgroundSnapshotInstance
      | undefined;

    // Replay the BSI subtree's `CreateElement` / `SetAttributes` / internal
    // `InsertBefore` ops — they were dropped pre-hydrate because
    // `__globalSnapshotPatch` was `undefined`. Pass `parentId=undefined` so
    // the topmost node is left orphan; we link it to the host element via
    // the following `nodesRefInsertBefore` instead.
    reconstructInstanceTree([child]);

    // Pre-hydrate `before` is effectively always undefined: preact's
    // initial diff appends each child sequentially, so the queued tuple's
    // third slot is undefined in normal flows. The `before?.__id` truthy
    // branch is exercised post-hydrate in the prepend-keyed-children test.
    /* v8 ignore start */
    __globalSnapshotPatch!.push(
      SnapshotOperation.nodesRefInsertBefore,
      serializeNodesRef(container),
      child.__id,
      before?.__id,
    );
    /* v8 ignore stop */
  }
  pendingInsertBefore.length = 0;
};
