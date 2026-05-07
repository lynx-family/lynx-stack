// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Apply-side handlers for the portal-only patch ops:
 *   - `nodesRefInsertBefore`
 *   - `nodesRefRemoveChild`
 * plus the shared selector lookup.
 *
 * Lives in its own module to keep `snapshotPatchApply.ts` focused on the
 * snapshot-tree ops (`CreateElement`/`InsertBefore`/`SetAttribute`/etc.).
 */

import { snapshotDestroyList } from '../../snapshot/list.js';
import { unref } from '../../snapshot/ref.js';
import { snapshotInstanceManager } from '../../snapshot/snapshot.js';
import type { SnapshotInstance } from '../../snapshot/snapshot.js';
import { traverseSnapshotInstance } from '../../snapshot/utils.js';

/**
 * Resolve a serialized NodesRef (the `identifier` string produced by
 * `serializeNodesRef`) to a single host FiberElement on the main thread.
 *
 * The identifier is treated as a CSS selector. This covers:
 *   - `RefProxy.selector` → `[react-ref-X-Y]` (a CSS attribute selector)
 *   - real `NodesRef` from `lynx.createSelectorQuery().select('#foo')`
 *
 * UNIQUE_ID / REF_ID-typed `NodesRef`s would need their respective Element
 * PAPIs (`__GetElementByUniqueId`, etc.) — TODO when needed.
 */
export function resolveNodesRefHost(identifier: string): FiberElement | undefined {
  const pageElement = __GetPageElement();
  if (!pageElement) return undefined;
  return __QuerySelector(pageElement, identifier, {});
}

export function applyNodesRefInsertBefore(
  identifier: string,
  child: SnapshotInstance,
  beforeId: number | undefined,
): void {
  const host = resolveNodesRefHost(identifier);
  if (!host) {
    throw new Error(
      `[createPortal] cannot resolve host for selector "${identifier}". `
        + `The host element does not exist on the main thread — check that the `
        + `\`NodesRef\` passed to \`createPortal\` points at a currently mounted element.`,
    );
  }
  if (!child.__elements) {
    child.ensureElements();
  }
  // `ensureElements` always sets `__element_root` for any registered
  // snapshot type, so the `!` is just there for the type checker.
  const childRoot = child.__element_root!;
  // `beforeId` is `null` for append-style inserts: preact passes `before =
  // null`, our `before?.__id` evaluates to `undefined`, and the patch's JSON
  // round-trip turns that `undefined` slot into `null`. A numeric `beforeId`
  // is always the `__id` of a sibling that the background already inserted
  // into the same `fakeRoot` (its `nodesRefInsertBefore` ran earlier in this
  // same patch and both sides share `snapshotInstanceManager`) — so the
  // non-null assertions hold by framework invariant.
  if (beforeId != null) {
    __InsertElementBefore(host, childRoot, snapshotInstanceManager.values.get(beforeId)!.__element_root);
    return;
  }
  __AppendElement(host, childRoot);
}

export function applyNodesRefRemoveChild(
  identifier: string,
  child: SnapshotInstance,
): void {
  // The child was inserted by an earlier `nodesRefInsertBefore` op which
  // calls `ensureElements`, so `__element_root` is always set here.
  const childRoot = child.__element_root!;
  // Mirror the worklet-ref teardown that `SnapshotInstance.removeChild`
  // runs. Without this, `main-thread:ref` callbacks on portaled subtrees
  // leak — `worklet._unmount` is never invoked, and any `WorkletRefImpl`
  // keeps pointing at the removed element.
  unref(child, true);
  const host = resolveNodesRefHost(identifier);
  // If the host is gone, its entire DOM subtree (including this portaled
  // child) was already removed by whoever unmounted the host — the
  // `__RemoveElement` call would be a no-op. Skip it; we still clean up
  // the SI manager bookkeeping below.
  if (host) {
    __RemoveElement(host, childRoot);
  }
  // Portal children aren't linked into a `SnapshotInstance` parent tree, so
  // the regular `RemoveChild` traversal never reaches them. Mirror the
  // teardown that `SnapshotInstance.removeChild` runs (see snapshot.ts):
  // destroy any `<list>` holders (otherwise native list callbacks +
  // `gSignMap`/`gRecycleMap` leak), unlink sibling/parent pointers, drop
  // element refs, and remove from the manager.
  traverseSnapshotInstance(child, v => {
    if (v.__snapshot_def.isListHolder) {
      snapshotDestroyList(v);
    }
    v.__parent = null;
    v.__previousSibling = null;
    v.__nextSibling = null;
    delete v.__elements;
    delete v.__element_root;
    snapshotInstanceManager.values.delete(v.__id);
  });
}
