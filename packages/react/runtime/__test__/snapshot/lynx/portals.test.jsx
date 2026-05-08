// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createContext, createPortal, useContext, useState } from '../../../src/index';
import { __root } from '../../../src/root';
import { setupPage, SnapshotInstance, snapshotInstanceManager } from '../../../src/snapshot';

const HOLE = null;
import { replaceCommitHook } from '../../../src/snapshot/lifecycle/patch/commit';
import {
  __globalSnapshotPatch,
  initGlobalSnapshotPatch,
  SnapshotOperation,
} from '../../../src/snapshot/lifecycle/patch/snapshotPatch';
import { snapshotPatchApply } from '../../../src/snapshot/lifecycle/patch/snapshotPatchApply';
import { injectUpdateMainThread } from '../../../src/snapshot/lifecycle/patch/updateMainThread';
import '../../../src/snapshot/lynx/component';
import { serializeNodesRef } from '../../../src/snapshot/lynx/nodesRef';
import { clearPendingPortalInsertBefore } from '../../../src/snapshot/lynx/portalsPending';
import { globalEnvManager } from '../utils/envManager';
import { elementTree } from '../utils/nativeMethod';
import { backgroundSnapshotInstanceManager } from '../../../src/snapshot';
import { globalBackgroundSnapshotInstancesToRemove } from '../../../src/snapshot/lifecycle/patch/globalState';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
  replaceCommitHook();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
  // Drain any portal ops queued by previous tests so they don't leak across.
  clearPendingPortalInsertBefore();
});

afterEach(() => {
  vi.restoreAllMocks();
  elementTree.clear();
});

/**
 * Drive a single ReactLynx render-then-hydrate cycle:
 *   - main thread renders the snapshot tree from `jsx`,
 *   - background thread does a full preact render of the same `jsx`,
 *   - the `firstScreen` lifecycle event is dispatched, producing a hydrate
 *     patch via `lynx.getNativeApp().callLepusMethod`,
 *   - the patch is applied back on the main thread.
 *
 * Returns the rLynxChange callback so tests can flip back to background
 * to fire the post-commit callback if they need to.
 */
function mountAndHydrate(jsx) {
  __root.__jsx = jsx;
  renderPage();

  globalEnvManager.switchToBackground();
  render(jsx, __root);

  // LifecycleConstant.firstScreen
  lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

  // hydrate patch -> main thread
  globalEnvManager.switchToMainThread();
  globalThis.__OnLifecycleEvent.mockClear();
  const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls.at(-1);
  globalThis[rLynxChange[0]](rLynxChange[1]);

  // post-commit callback runs on background
  globalEnvManager.switchToBackground();
  rLynxChange[2]?.();
  return rLynxChange;
}

/**
 * After hydrate, drive all pending patchUpdate cycles since `beforeCount`:
 * apply every queued `callLepusMethod` call on the main thread, then fire
 * its post-commit callback on background. State updates that span multiple
 * commits (e.g. setState that re-renders twice) need every patch flushed
 * to keep the main-thread tree caught up.
 */
function flushBackgroundUpdate(beforeCount) {
  const calls = lynx.getNativeApp().callLepusMethod.mock.calls;
  expect(calls.length).toBeGreaterThan(beforeCount);
  for (let i = beforeCount; i < calls.length; i++) {
    const rLynxChange = calls[i];
    globalEnvManager.switchToMainThread();
    globalThis[rLynxChange[0]](rLynxChange[1]);
    globalEnvManager.switchToBackground();
    rLynxChange[2]?.();
  }
}

describe('createPortal', () => {
  it('returns a VNode whose containerInfo points at the host ref (background only)', () => {
    const fakeNodesRef = { selector: '[react-ref-99-0]' };

    // Main thread short-circuits to `null` so the Portal component +
    // `preact` imports tree-shake out of the main-thread chunk.
    globalEnvManager.switchToMainThread();
    expect(createPortal(<text>x</text>, fakeNodesRef)).toBeNull();

    // Background thread is the only place the portal vnode actually
    // materializes.
    globalEnvManager.switchToBackground();
    const vnode = createPortal(<text>x</text>, fakeNodesRef);
    expect(vnode).toBeTruthy();
    expect(vnode.containerInfo).toBe(fakeNodesRef);
    // Portal vnode itself isn't a host element — its `type` is the internal
    // Portal function component.
    expect(typeof vnode.type).toBe('function');
  });

  /**
   * Walks the pre-hydrate → hydrate → unmount path:
   *
   *   1. Background's first render queues the portal child into
   *      `pendingInsertBefore` (because `__globalSnapshotPatch` is `undefined`
   *      pre-hydrate).
   *   2. `clearPendingPortalInsertBefore`, called from inside hydrate, replays
   *      the queue: `reconstructInstanceTree` re-emits the portal subtree's
   *      `CreateElement` / `SetAttributes`, then a `nodesRefInsertBefore` op
   *      attaches it to the host element via the `[react-ref-X-Y]` selector.
   *   3. `render(null, __root)` triggers Portal's `componentWillUnmount`,
   *      which calls `render(null, _temp)`. preact's `removeNode` then walks
   *      `child.parentNode.removeChild(child)` — and reaches our
   *      `fakeRoot.removeChild` because we wired `child.__parent = fakeRoot`
   *      on insertion. The resulting `nodesRefRemoveChild` op detaches the
   *      element from host on the main thread.
   */
  it('mounts/hydrates/unmounts a portal end to end', async () => {
    // baseline: each side has its own root SI (main + bg).
    expect(snapshotInstanceManager.values.size).toBe(1);
    expect(backgroundSnapshotInstanceManager.values.size).toBe(1);

    function App() {
      const [host, setHost] = useState(null);
      return (
        <view>
          <view data-testid='host' ref={setHost} />
          {host && createPortal(<text data-testid='portaled'>hi</text>, host)}
        </view>
      );
    }

    // Pre-hydrate: main thread direct render + background render.
    // Background creates the portal child BSI; its `CreateElement` push is
    // dropped (global patch is `undefined`) and `fakeRoot.insertBefore`
    // queues into `pendingInsertBefore` instead of pushing a patch op.
    mountAndHydrate(<App />);

    // After hydrate, the portal subtree should be attached under the host
    // element via the `nodesRefInsertBefore` op replayed from
    // `clearPendingPortalInsertBefore`.
    globalEnvManager.switchToMainThread();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <view
            dataset={
              {
                "testid": "host",
              }
            }
            react-ref--2-0={1}
          >
            <text
              dataset={
                {
                  "testid": "portaled",
                }
              }
            >
              <raw-text
                text="hi"
              />
            </text>
          </view>
          <wrapper />
        </view>
      </page>
    `);

    // SI for the portaled <text> exists on the main thread.
    const portaledIds = [...snapshotInstanceManager.values.values()]
      .filter((si) => si.__elements?.some((el) => el?.props?.dataset?.testid === 'portaled'))
      .map((si) => si.__id);
    expect(portaledIds.length).toBe(1);

    // Tear down the whole tree — exercises Portal's `componentWillUnmount`,
    // which calls `render(null, _temp)`; preact's diff then routes through
    // `child.parentNode.removeChild(child)` → our `fakeRoot.removeChild` →
    // `nodesRefRemoveChild` patch op. Apply that patch back on main thread
    // to exercise the `nodesRefRemoveChild` apply branch + `__RemoveElement`.
    vi.useFakeTimers();
    const before = lynx.getNativeApp().callLepusMethod.mock.calls.length;
    globalEnvManager.switchToBackground();
    render(null, __root);
    await Promise.resolve().then(() => {});
    expect(lynx.getNativeApp().callLepusMethod.mock.calls.length).toBeGreaterThan(before);
    flushBackgroundUpdate(before);

    globalEnvManager.switchToMainThread();
    // After unmount, the host element no longer has the portaled child.
    expect(findRawText(__root.__element_root, /^hi$/)).toBeNull();

    // BSI cleanup is debounced 10s by commit's `setTimeout`; advance to
    // drain. This catches both the regular tree teardown AND the portal
    // subtree (via `fakeRoot.removeChild` enqueueing into
    // `globalBackgroundSnapshotInstancesToRemove`).
    vi.advanceTimersByTime(10000);
    vi.useRealTimers();

    // back to baseline (only the root SI on each side).
    expect(snapshotInstanceManager.values.size).toBe(1);
    expect(backgroundSnapshotInstanceManager.values.size).toBe(1);
  });

  /**
   * Pre-hydrate cancellation: a portal child queued by `fakeRoot.insertBefore`
   * (because `__globalSnapshotPatch` is `undefined`) and then immediately
   * removed by `fakeRoot.removeChild` (still pre-hydrate) must be dropped
   * from `pendingInsertBefore` so the queue replay during hydrate doesn't
   * resurrect a node that was already torn down on background.
   */
  it('drops pre-hydrate inserts that were cancelled before hydrate', () => {
    // Use a hard-coded NodesRef so the portal mounts synchronously on the
    // first render — going through `useState`/callback-ref would defer the
    // portal mount to a microtask and we'd need extra render flushes.
    const fakeHost = { selector: '[react-ref-cancelled-test]' };

    function App({ show }) {
      return (
        <view>
          {show && createPortal(<text data-testid='cancelled'>cancelled</text>, fakeHost)}
        </view>
      );
    }

    // Pre-hydrate: render with portal mounted (queues into `pendingInsertBefore`).
    globalEnvManager.switchToBackground();
    render(<App show={true} />, __root);
    // Re-render without the portal — Portal unmounts, `fakeRoot.removeChild`
    // fires while `__globalSnapshotPatch` is still undefined and our
    // cancellation path drains the matching tuple from the queue.
    render(<App show={false} />, __root);

    // Hydrate flushes the queue — the cancelled child must NOT appear.
    globalEnvManager.switchToMainThread();
    initGlobalSnapshotPatch();
    clearPendingPortalInsertBefore();
    expect(__globalSnapshotPatch).toEqual([]);
  });

  /**
   * Portal mounts AFTER hydrate (state flips from "no portal" to "portal").
   * Exercises the post-hydrate branch of `fakeRoot.insertBefore`, where
   * `__globalSnapshotPatch` is already initialized and the op is pushed
   * directly instead of going through `pendingInsertBefore`.
   */
  it('mounts a portal post-hydrate via state change', async () => {
    let setShow;
    function App() {
      const [host, setHost] = useState(null);
      const [show, _setShow] = useState(false);
      setShow = _setShow;
      return (
        <view>
          <view data-testid='host' ref={setHost} />
          {show && host && createPortal(<text data-testid='late'>late</text>, host)}
        </view>
      );
    }

    // Mount with no portal — pre-hydrate path doesn't queue anything.
    mountAndHydrate(<App />);

    // Now post-hydrate. Trigger the portal mount via state change.
    const before = lynx.getNativeApp().callLepusMethod.mock.calls.length;
    globalEnvManager.switchToBackground();
    setShow(true);
    await Promise.resolve().then(() => {});
    flushBackgroundUpdate(before);

    globalEnvManager.switchToMainThread();
    expect(findRawText(__root.__element_root, /^late$/)).not.toBeNull();
  });

  /**
   * Post-hydrate show/hide of a portal must NOT leak
   * `BackgroundSnapshotInstance` entries into
   * `backgroundSnapshotInstanceManager`. The bg-side `fakeRoot.removeChild`
   * mirrors `BackgroundSnapshotInstance.removeChild` and enqueues the
   * removed subtree id into `globalBackgroundSnapshotInstancesToRemove`
   * so commit-time `tearDown` (debounced 10s) drops the BSIs.
   */
  it('does not leak BSI entries when a portal is toggled off post-hydrate', async () => {
    let setShow;
    function App() {
      const [host, setHost] = useState(null);
      const [show, _setShow] = useState(false);
      setShow = _setShow;
      return (
        <view>
          <view data-testid='host' ref={setHost} />
          {show && host && createPortal(<text data-testid='late'>late</text>, host)}
        </view>
      );
    }
    mountAndHydrate(<App />);

    // Mount the portal via state change.
    let before = lynx.getNativeApp().callLepusMethod.mock.calls.length;
    globalEnvManager.switchToBackground();
    const sizeBeforeMount = backgroundSnapshotInstanceManager.values.size;
    setShow(true);
    await Promise.resolve().then(() => {});
    flushBackgroundUpdate(before);
    expect(backgroundSnapshotInstanceManager.values.size).toBeGreaterThan(sizeBeforeMount);

    // Now unmount the portal via state change. `fakeRoot.removeChild` should
    // queue the portal child's BSI id into the cleanup list, which commit
    // captures and drains via a debounced 10s `tearDown`.
    vi.useFakeTimers();
    before = lynx.getNativeApp().callLepusMethod.mock.calls.length;
    globalEnvManager.switchToBackground();
    setShow(false);
    await Promise.resolve().then(() => {});
    flushBackgroundUpdate(before);
    // Drive the debounced commit cleanup. Without the bg-side enqueue in
    // `fakeRoot.removeChild`, this advance is a no-op and the portal
    // child BSI stays in the manager.
    vi.advanceTimersByTime(10000);
    vi.useRealTimers();

    expect(backgroundSnapshotInstanceManager.values.size).toBe(sizeBeforeMount);
  });

  /**
   * Re-rendering Portal with a NEW container ref (different `_container`
   * value) takes the early `componentWillUnmount` branch in `Portal()` —
   * this is the "container changed, tear down old, mount new" path.
   */
  it('handles container swap by tearing down the old portal', async () => {
    let setUseB;
    function App() {
      const [aHost, setAHost] = useState(null);
      const [bHost, setBHost] = useState(null);
      const [useB, _setUseB] = useState(false);
      setUseB = _setUseB;
      const target = useB ? bHost : aHost;
      return (
        <view>
          <view data-testid='a' ref={setAHost} />
          <view data-testid='b' ref={setBHost} />
          {target && createPortal(<text data-testid='movable'>movable</text>, target)}
        </view>
      );
    }

    mountAndHydrate(<App />);

    // Initial mount: target is `aHost`, so `<text>movable</text>` is portaled
    // under A.
    globalEnvManager.switchToMainThread();
    {
      const a = findByTestId(__root.__element_root, 'a');
      const b = findByTestId(__root.__element_root, 'b');
      expect(containsRawText(a, /^movable$/)).toBe(true);
      expect(containsRawText(b, /^movable$/)).toBe(false);
    }

    // Swap the container — Portal should see `_container !== container` and
    // tear down before re-mounting under B.
    const before = lynx.getNativeApp().callLepusMethod.mock.calls.length;
    globalEnvManager.switchToBackground();
    setUseB(true);
    await Promise.resolve().then(() => {});
    flushBackgroundUpdate(before);

    globalEnvManager.switchToMainThread();
    {
      const a = findByTestId(__root.__element_root, 'a');
      const b = findByTestId(__root.__element_root, 'b');
      expect(containsRawText(a, /^movable$/)).toBe(false);
      expect(containsRawText(b, /^movable$/)).toBe(true);
    }
  });

  /**
   * Prepending a keyed sibling to a multi-child portal forces preact to
   * call `fakeRoot.insertBefore(newChild, existingChild)` — covers the
   * `before?.__id` truthy branch + apply-side `__InsertElementBefore`
   * (vs the trailing `__AppendElement`) path. Asserts children order
   * under the host so a regression that lands 'c' at the tail
   * (i.e. silently falling back to `__AppendElement`) fails the test.
   */
  it('prepends to a keyed multi-child portal', async () => {
    let prependC;
    function App() {
      const [host, setHost] = useState(null);
      const [items, setItems] = useState(['a', 'b']);
      prependC = () => setItems(['c', 'a', 'b']);
      return (
        <view>
          <view data-testid='host' ref={setHost} />
          {host && createPortal(
            <>
              {items.map((label) => (
                <view key={label}>
                  <text>{label}</text>
                </view>
              ))}
            </>,
            host,
          )}
        </view>
      );
    }

    mountAndHydrate(<App />);

    // Pre-prepend baseline: portal renders [a, b] under host in that order.
    {
      globalEnvManager.switchToMainThread();
      const host = findByTestId(__root.__element_root, 'host');
      const labels = host.children.map((child) => findRawText(child, /.+/)?.props?.text);
      expect(labels).toEqual(['a', 'b']);
    }

    const before = lynx.getNativeApp().callLepusMethod.mock.calls.length;
    globalEnvManager.switchToBackground();
    prependC();
    await Promise.resolve().then(() => {});
    flushBackgroundUpdate(before);

    // After prepend: 'c' must land at the head, NOT the tail.
    globalEnvManager.switchToMainThread();
    const host = findByTestId(__root.__element_root, 'host');
    const labels = host.children.map((child) => findRawText(child, /.+/)?.props?.text);
    expect(labels).toEqual(['c', 'a', 'b']);
  });

  /**
   * Context flows across the portal boundary — exercises the internal
   * `ContextProvider` wrapper that Portal injects so `this.context` (the
   * caller-side context) is re-attached when re-rendering into the fake root.
   */
  it('forwards context across the portal boundary', () => {
    const Theme = createContext('light');

    function Leaf() {
      const theme = useContext(Theme);
      return <text>theme:{theme}</text>;
    }

    function App() {
      const [host, setHost] = useState(null);
      return (
        <view>
          <view ref={setHost} />
          <Theme.Provider value='dark'>
            {host && createPortal(<Leaf />, host)}
          </Theme.Provider>
        </view>
      );
    }

    mountAndHydrate(<App />);

    globalEnvManager.switchToMainThread();
    expect(findRawText(__root.__element_root, /dark/)).not.toBeNull();
    expect(findRawText(__root.__element_root, /^theme:$/)).not.toBeNull();
  });
});

describe('serializeNodesRef', () => {
  /**
   * Real `NodesRef` (returned by `lynx.createSelectorQuery().select(...)`)
   * exposes `_nodeSelectToken` with `type: 0` and a CSS-selector identifier.
   */
  it('falls back to `_nodeSelectToken.identifier` for non-RefProxy refs', () => {
    const fakeNodesRef = { _nodeSelectToken: { type: 0, identifier: '#some-id' } };
    expect(serializeNodesRef(fakeNodesRef)).toBe('#some-id');
  });

  /**
   * `selectUniqueID` / `selectReactRef` produce tokens whose `identifier`
   * is NOT a CSS selector — we'd silently no-op on the main thread if we
   * accepted them. Throw a clear error at the createPortal call site
   * instead.
   */
  it('throws for non-selector NodesRef token types', () => {
    const uniqueIdRef = { _nodeSelectToken: { type: 2, identifier: '42' } };
    expect(() => serializeNodesRef(uniqueIdRef))
      .toThrowErrorMatchingInlineSnapshot(
        `[Error: [createPortal] unsupported NodesRef type 2 (identifier "42"). Pass a CSS-selector NodesRef from \`lynx.createSelectorQuery().select(...)\` or a React ref instead.]`,
      );
  });
});

describe('snapshotPatchApply for nodesRef ops', () => {
  beforeEach(() => {
    initGlobalSnapshotPatch();
  });

  /**
   * Unknown `childId` is a bg/main desync (stale background reference,
   * double-unmount, etc.) — soft-fail with a `ctx-not-found` event so
   * background can re-sync, mirroring the regular `InsertBefore` /
   * `RemoveChild` ops in this dispatcher.
   */
  it('soft-fails on unknown childId in nodesRefInsertBefore', () => {
    globalEnvManager.switchToMainThread();
    lynx.getJSContext().dispatchEvent.mockClear();
    expect(() =>
      snapshotPatchApply([
        SnapshotOperation.nodesRefInsertBefore,
        '[react-ref-999-0]',
        99999,
        undefined,
      ])
    ).not.toThrow();
    expect(lynx.getJSContext().dispatchEvent.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "data": {
              "id": 99999,
            },
            "type": "Lynx.Error.CtxNotFound",
          },
        ],
      ]
    `);
  });

  it('soft-fails on unknown childId in nodesRefRemoveChild', () => {
    globalEnvManager.switchToMainThread();
    lynx.getJSContext().dispatchEvent.mockClear();
    expect(() =>
      snapshotPatchApply([
        SnapshotOperation.nodesRefRemoveChild,
        '[react-ref-999-0]',
        99999,
      ])
    ).not.toThrow();
    expect(lynx.getJSContext().dispatchEvent.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "data": {
              "id": 99999,
            },
            "type": "Lynx.Error.CtxNotFound",
          },
        ],
      ]
    `);
  });

  /**
   * Insert with a stale selector is a caller bug — throw via the non-null
   * assertion on `resolveNodesRefHost`. Remove with a stale selector is
   * tolerated because natural teardown ordering (host unmounted before
   * portal children, e.g. container swap or recycled list-items) lands
   * here legitimately.
   */
  it('throws when host selector cannot be resolved on insert', () => {
    globalEnvManager.switchToMainThread();
    const childId = -9999;
    snapshotPatchApply([
      SnapshotOperation.CreateElement,
      '__snapshot_a94a8_test_1',
      childId,
    ]);
    expect(snapshotInstanceManager.values.has(childId)).toBe(true);

    expect(() =>
      snapshotPatchApply([
        SnapshotOperation.nodesRefInsertBefore,
        '[no-such-attr]',
        childId,
        undefined,
      ])
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: [createPortal] cannot resolve host for selector "[no-such-attr]". The host element does not exist on the main thread — check that the \`NodesRef\` passed to \`createPortal\` points at a currently mounted element.]`,
    );
  });

  it('soft-fails when host selector cannot be resolved on remove', () => {
    globalEnvManager.switchToMainThread();
    // Materialize a child with an `__element_root` (the realistic state at
    // remove time — an earlier `nodesRefInsertBefore` op would have set it).
    const childId = -9998;
    snapshotPatchApply([
      SnapshotOperation.CreateElement,
      '__snapshot_a94a8_test_1',
      childId,
    ]);
    snapshotInstanceManager.values.get(childId).ensureElements();

    // Remove must not throw even when the host is gone — see the comment
    // on `applyNodesRefRemoveChild`. The portal child SI is still cleaned up.
    expect(() =>
      snapshotPatchApply([
        SnapshotOperation.nodesRefRemoveChild,
        '[no-such-attr]',
        childId,
      ])
    ).not.toThrow();
    expect(snapshotInstanceManager.values.has(childId)).toBe(false);
  });

  /**
   * `applyNodesRefRemoveChild` mirrors `SnapshotInstance.removeChild`'s
   * traversal cleanup. The list-holder branch must call `snapshotDestroyList`
   * so portaled `<list>` subtrees don't leak `gSignMap` / `gRecycleMap` /
   * native callbacks. Visible side effects mirror `list.test.jsx`'s
   * destroy assertions: `__DestroyLifetime` listener is removed, and
   * the list element's callbacks are replaced with the cleanup trio.
   */
  it('runs snapshotDestroyList for portaled list-holder on remove', () => {
    const listHolder = __SNAPSHOT__(<list>{HOLE}</list>);
    const childId = -9997;
    // Register a SI for the list-holder snapshot type, then materialize.
    new SnapshotInstance(listHolder, childId);
    snapshotInstanceManager.values.get(childId).ensureElements();
    const listElement = snapshotInstanceManager.values.get(childId).__elements[0];
    expect(listElement.componentAtIndex).not.toBeNull();

    globalEnvManager.switchToMainThread();
    snapshotPatchApply([
      SnapshotOperation.nodesRefRemoveChild,
      '[no-such-attr]',
      childId,
    ]);
    // After `snapshotDestroyList`, the cleanup trio replaces the real
    // callbacks: `componentAtIndex` returns `-1`, the others are no-ops.
    expect(listElement.componentAtIndex()).toBe(-1);
    expect(listElement.enqueueComponent()).toBeUndefined();
    expect(snapshotInstanceManager.values.has(childId)).toBe(false);
  });
});

function findRawText(node, pattern) {
  if (!node) return null;
  if (node.type === 'raw-text' && pattern.test(node.props?.text ?? '')) {
    return node;
  }
  for (const child of node.children ?? []) {
    const hit = findRawText(child, pattern);
    if (hit) return hit;
  }
  return null;
}

function findByTestId(node, testid) {
  if (!node) return null;
  if (node.props?.dataset?.testid === testid) return node;
  for (const child of node.children ?? []) {
    const hit = findByTestId(child, testid);
    if (hit) return hit;
  }
  return null;
}

function containsRawText(node, pattern) {
  return findRawText(node, pattern) !== null;
}
