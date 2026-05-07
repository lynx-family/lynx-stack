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

import { snapshotInstanceManager } from '../../snapshot/snapshot.js';
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
  childId: number,
  beforeId: number | undefined,
): void {
  const child = snapshotInstanceManager.values.get(childId);
  if (!child) {
    throw new Error(
      `[createPortal] cannot insert child #${childId} under "${identifier}": `
        + `child SnapshotInstance is not registered on the main thread. This usually `
        + `means the portal was given a stale background reference (e.g. mounted twice, `
        + `or the patch buffer was cleared between background and main thread).`,
    );
  }
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
  childId: number,
): void {
  const child = snapshotInstanceManager.values.get(childId);
  if (!child) {
    throw new Error(
      `[createPortal] cannot remove child #${childId} under "${identifier}": `
        + `child SnapshotInstance is not registered on the main thread (likely a `
        + `double-unmount).`,
    );
  }
  // The child was inserted by an earlier `nodesRefInsertBefore` op which
  // calls `ensureElements`, so `__element_root` is always set here.
  const childRoot = child.__element_root!;
  const host = resolveNodesRefHost(identifier);
  // If the host is gone, its entire DOM subtree (including this portaled
  // child) was already removed by whoever unmounted the host — the
  // `__RemoveElement` call would be a no-op. Skip it; we still clean up
  // the SI manager bookkeeping below.
  if (host) {
    __RemoveElement(host, childRoot);
  }
  // Portal children aren't linked into a `SnapshotInstance` parent tree, so
  // the regular `RemoveChild` traversal never reaches them. Tear them down
  // here so repeated portal mount/unmount cycles don't leak SI entries.
  traverseSnapshotInstance(child, v => {
    snapshotInstanceManager.values.delete(v.__id);
  });
}
