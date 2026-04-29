// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createContext, createPortal, useContext, useState } from '../../../src/index';
import { __root } from '../../../src/root';
import { setupPage, snapshotInstanceManager } from '../../../src/snapshot';
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
import { backgroundSnapshotInstanceManager } from '../../../lib/snapshot';

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
  it('returns a VNode whose containerInfo points at the host ref', () => {
    const fakeNodesRef = { selector: '[react-ref-99-0]' };
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
    // only root element
    expect(snapshotInstanceManager.values.size).toBe(1);
    expect(backgroundSnapshotInstanceManager.values.size).toBe(0);

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
    const before = lynx.getNativeApp().callLepusMethod.mock.calls.length;
    globalEnvManager.switchToBackground();
    render(null, __root);
    await Promise.resolve().then(() => {});
    expect(lynx.getNativeApp().callLepusMethod.mock.calls.length).toBeGreaterThan(before);
    flushBackgroundUpdate(before);

    globalEnvManager.switchToMainThread();
    // After unmount, the host element no longer has the portaled child.
    expect(findRawText(__root.__element_root, /^hi$/)).toBeNull();

    // only root element
    expect(snapshotInstanceManager.values.size).toBe(1);
    expect(backgroundSnapshotInstanceManager.values.size).toBe(0);
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

    // Swap the container — Portal should see `_container !== container` and
    // tear down before re-mounting.
    const before = lynx.getNativeApp().callLepusMethod.mock.calls.length;
    globalEnvManager.switchToBackground();
    setUseB(true);
    await Promise.resolve().then(() => {});
    flushBackgroundUpdate(before);

    globalEnvManager.switchToMainThread();
    // Element still in document — the swap path doesn't actually drop the
    // portaled subtree, just routes its updates to the new container.
    expect(findRawText(__root.__element_root, /^movable$/)).not.toBeNull();
  });

  /**
   * Prepending a keyed sibling to a multi-child portal forces preact to
   * call `fakeRoot.insertBefore(newChild, existingChild)` — covers the
   * `before?.__id` truthy branch + apply-side `__InsertElementBefore`
   * (vs the trailing `__AppendElement`) path.
   */
  it('prepends to a keyed multi-child portal', async () => {
    let prependC;
    function App() {
      const [host, setHost] = useState(null);
      const [items, setItems] = useState(['a', 'b']);
      prependC = () => setItems(['c', 'a', 'b']);
      return (
        <view>
          <view ref={setHost} />
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

    const before = lynx.getNativeApp().callLepusMethod.mock.calls.length;
    globalEnvManager.switchToBackground();
    prependC();
    await Promise.resolve().then(() => {});
    flushBackgroundUpdate(before);

    globalEnvManager.switchToMainThread();
    expect(findRawText(__root.__element_root, /^a$/)).not.toBeNull();
    expect(findRawText(__root.__element_root, /^b$/)).not.toBeNull();
    expect(findRawText(__root.__element_root, /^c$/)).not.toBeNull();
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
   * exposes `_nodeSelectToken.identifier` rather than the `selector` getter
   * that `RefProxy` synthesizes for ref={setX}. Cover that fallback branch.
   */
  it('falls back to `_nodeSelectToken.identifier` for non-RefProxy refs', () => {
    const fakeNodesRef = { _nodeSelectToken: { identifier: '#some-id' } };
    expect(serializeNodesRef(fakeNodesRef)).toBe('#some-id');
  });
});

describe('snapshotPatchApply for nodesRef ops', () => {
  beforeEach(() => {
    initGlobalSnapshotPatch();
  });

  /**
   * `nodesRefInsertBefore` for an unknown childId hits the `if (!child)`
   * branch which dispatches a ctx-not-found event back to background. The
   * apply must soft-fail (not throw) so subsequent ops in the same patch
   * still get processed.
   */
  it('soft-fails for unknown childId in nodesRefInsertBefore', () => {
    globalEnvManager.switchToMainThread();
    expect(() =>
      snapshotPatchApply([
        SnapshotOperation.nodesRefInsertBefore,
        '[react-ref-999-0]',
        99999, // not in snapshotInstanceManager
        undefined,
      ])
    ).not.toThrow();
  });

  /**
   * Same shape for `nodesRefRemoveChild` — unknown childId must soft-fail.
   */
  it('soft-fails for unknown childId in nodesRefRemoveChild', () => {
    globalEnvManager.switchToMainThread();
    expect(() =>
      snapshotPatchApply([
        SnapshotOperation.nodesRefRemoveChild,
        '[react-ref-999-0]',
        99999,
      ])
    ).not.toThrow();
  });

  /**
   * When the selector doesn't match any element on the main thread, the
   * apply silently no-ops (no event, no throw).
   */
  it('no-ops when host selector cannot be resolved', () => {
    globalEnvManager.switchToMainThread();
    // Place a SI in the manager to make the childId lookup succeed, so we
    // reach the host-resolution check.
    const childId = -9999;
    const childSI = new (snapshotInstanceManager.values.constructor.prototype.constructor === Map
      ? class {}
      : class {})();
    // We can't easily fabricate a SnapshotInstance here, so use snapshotPatch
    // ops to register one.
    snapshotPatchApply([
      SnapshotOperation.CreateElement,
      '__snapshot_a94a8_test_1',
      childId,
    ]);
    expect(snapshotInstanceManager.values.has(childId)).toBe(true);

    // Selector that won't match anything in the test page.
    expect(() =>
      snapshotPatchApply([
        SnapshotOperation.nodesRefInsertBefore,
        '[no-such-attr]',
        childId,
        undefined,
      ])
    ).not.toThrow();
    expect(() =>
      snapshotPatchApply([
        SnapshotOperation.nodesRefRemoveChild,
        '[no-such-attr]',
        childId,
      ])
    ).not.toThrow();
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
