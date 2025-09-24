// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { render, Component } from 'preact';
import { Suspense } from '../../src/index';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { replaceCommitHook } from '../../src/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../src/lifecycle/patch/updateMainThread';
import '../../src/lynx/component';
import { __root } from '../../src/root';
import { setupPage, SnapshotInstance, snapshotInstanceManager } from '../../src/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { elementTree } from '../utils/nativeMethod';
import { backgroundSnapshotInstanceManager } from '../../src/snapshot';
import { prettyFormatSnapshotPatch } from '../../src/debug/formatPatch';
import { createSuspender } from '../createSuspender';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
  replaceCommitHook();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
  vi.useFakeTimers({ toFake: ['setTimeout'] });
});

afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  elementTree.clear();
});

describe('suspense', () => {
  /**
   * Tests the basic functionality of the `Suspense` component.
   *
   * This test covers the entire lifecycle of a suspended component:
   * 1. The initial render on the main thread.
   * 2. The background thread starts rendering and encounters the suspended component.
   * 3. Hydration occurs on the main thread, creating a placeholder wrapper element.
   * 4. The fallback UI is rendered from the background thread.
   * 5. The promise is resolved, and the actual content is rendered from the
   *    background thread, replacing the fallback.
   */
  it('should render fallback and content correctly', async () => {
    const { Suspender, suspended } = createSuspender();

    function Comp() {
      return (
        <Suspense fallback={<text>loading</text>}>
          <Suspender>
            <text>foo</text>
          </Suspender>
        </Suspense>
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper>
            <text>
              <raw-text
                text="loading"
              />
            </text>
          </wrapper>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper>
            <text>
              <raw-text
                text="loading"
              />
            </text>
          </wrapper>
        </page>
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }

    // render children
    {
      globalEnvManager.switchToBackground();
      suspended.resolve();
      lynx.getNativeApp().callLepusMethod.mockClear();
      await Promise.resolve().then(() => {});
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper>
            <text>
              <raw-text
                text="foo"
              />
            </text>
          </wrapper>
        </page>
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }
  });

  /**
   * This test case verifies that `Suspense` works correctly when its direct
   * child is a host element (e.g., `<view>`) instead of a component.
   *
   * It follows the complete lifecycle:
   * 1. Initial render on the main thread.
   * 2. Background thread starts rendering, encountering the suspended component.
   * 3. Hydration on the main thread, which should render the `<view>` element
   *    inside a wrapper, but not its suspended children.
   * 4. The fallback UI is rendered from the background thread. The test asserts
   *    the snapshot patch includes a `PreventDestroy` operation to keep the
   *    host element (`<view>`) from being incorrectly destroyed.
   * 5. The promise is resolved, and the actual children are rendered from the
   *    background thread, replacing the fallback.
   */
  it('should support a host element as a direct child', async () => {
    const { Suspender, suspended } = createSuspender();

    function Comp() {
      return (
        <Suspense fallback={<text>loading</text>}>
          <view attr={`an attr`}>
            <Suspender>
              <text>foo</text>
            </Suspender>
          </view>
        </Suspense>
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper>
            <text>
              <raw-text
                text="loading"
              />
            </text>
          </wrapper>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper>
            <text>
              <raw-text
                text="loading"
              />
            </text>
          </wrapper>
        </page>
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }

    // render children
    {
      globalEnvManager.switchToBackground();
      suspended.resolve();
      lynx.getNativeApp().callLepusMethod.mockClear();
      await Promise.resolve().then(() => {});
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);
      const data = JSON.parse(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).patchList[0].snapshotPatch;
      expect(prettyFormatSnapshotPatch(data)).toMatchInlineSnapshot(`
        [
          {
            "id": 2,
            "op": "CreateElement",
            "type": "wrapper",
          },
          {
            "id": 3,
            "op": "CreateElement",
            "type": "__Card__:__snapshot_a94a8_test_4",
          },
          {
            "id": 3,
            "op": "SetAttributes",
            "values": [
              "an attr",
            ],
          },
          {
            "beforeId": null,
            "childId": 3,
            "op": "InsertBefore",
            "parentId": 2,
          },
          {
            "beforeId": null,
            "childId": 2,
            "op": "InsertBefore",
            "parentId": -1,
          },
          {
            "childId": -3,
            "op": "RemoveChild",
            "parentId": -1,
          },
          {
            "id": 7,
            "op": "CreateElement",
            "type": "__Card__:__snapshot_a94a8_test_5",
          },
          {
            "beforeId": null,
            "childId": 7,
            "op": "InsertBefore",
            "parentId": 3,
          },
          {
            "beforeId": null,
            "childId": 2,
            "op": "InsertBefore",
            "parentId": -1,
          },
        ]
      `);
      vi.runAllTimers();

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper>
            <view
              attr="an attr"
            >
              <text>
                <raw-text
                  text="foo"
                />
              </text>
            </view>
          </wrapper>
        </page>
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }
  });

  /**
   * This test case ensures that when a `Suspense` component is unmounted,
   * all its managed elements are correctly cleaned up from the snapshot
   * instance managers on both the main and background threads.
   *
   * The test follows these steps:
   * 1. Renders a component containing a `Suspense` boundary, initially visible.
   * 2. The `Suspense` boundary goes through its complete lifecycle: hydration,
   *    rendering a fallback, and finally rendering its children.
   * 3. The component is re-rendered to hide the `Suspense` boundary, triggering
   *    its unmount.
   * 4. It asserts that the corresponding elements are removed from the main
   *    thread's element tree.
   * 5. It verifies that the snapshot instances on both the main and background
   *    threads are properly removed after the unmount, preventing
   *    memory leaks.
   */
  it('should clean up elements when unmounted', async () => {
    const { Suspender, suspended } = createSuspender();

    function Comp({ show }) {
      return (
        show && (
          <Suspense fallback={<text>loading</text>}>
            <view attr={`an attr`}>
              <Suspender>
                <text>foo</text>
              </Suspender>
            </view>
          </Suspense>
        )
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp show={true} />;
      renderPage();
      // `-2` and `-3` are two wrappers created by `createElement` in suspense.
      // TODO: remove them from `snapshotInstanceManager`.
      expect([...snapshotInstanceManager.values.keys()]).toMatchInlineSnapshot(`
        [
          -1,
          -2,
          -3,
          -4,
        ]
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp show={true} />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }

    // render children
    {
      globalEnvManager.switchToBackground();
      suspended.resolve();
      lynx.getNativeApp().callLepusMethod.mockClear();
      await Promise.resolve().then(() => {});
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);
      vi.runAllTimers();

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper>
            <view
              attr="an attr"
            >
              <text>
                <raw-text
                  text="foo"
                />
              </text>
            </view>
          </wrapper>
        </page>
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
      expect([...backgroundSnapshotInstanceManager.values.keys()]).toMatchInlineSnapshot(`
        [
          2,
          3,
          4,
          -1,
          7,
        ]
      `);
    }

    // remove suspense
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      render(<Comp show={false} />, __root);
      await Promise.resolve().then(() => {});
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        />
      `);
      expect([...snapshotInstanceManager.values.keys()]).toMatchInlineSnapshot(`
        [
          -1,
          -2,
        ]
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
      expect([...backgroundSnapshotInstanceManager.values.keys()]).toMatchInlineSnapshot(`
        [
          4,
          -1,
        ]
      `);
      expect(backgroundSnapshotInstanceManager.values.get(4).type).toBe('div');
    }
  });

  /**
   * This test case is forked from `should correctly remove elements after suspense destroyed`
   * with an additional step to verify that the `Suspense` component can be correctly
   * mounted again after being unmounted.
   *
   * It tests the full lifecycle: mount -> unmount -> remount.
   * 1. Renders a component with a `Suspense` boundary, initially visible.
   * 2. The `Suspense` boundary goes through its complete lifecycle: hydration,
   *    rendering a fallback, and finally rendering its children.
   * 3. The component is re-rendered to hide the `Suspense` boundary, triggering
   *    its unmount. All associated elements should be cleaned up.
   * 4. The component is re-rendered again to show the `Suspense` boundary.
   * 5. It asserts that the `Suspense` boundary and its children are correctly
   *    re-rendered, ensuring that the unmount/remount cycle does not leave the
   *    component in an inconsistent state.
   */
  it('should support being unmounted and remounted', async () => {
    const { Suspender, suspended } = createSuspender();

    function Comp({ show }) {
      return (
        show && (
          <Suspense fallback={<text>loading</text>}>
            <view attr={`an attr`}>
              <Suspender>
                <text>foo</text>
              </Suspender>
            </view>
          </Suspense>
        )
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp show={true} />;
      renderPage();
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp show={true} />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }

    // render children
    {
      globalEnvManager.switchToBackground();
      suspended.resolve();
      lynx.getNativeApp().callLepusMethod.mockClear();
      await Promise.resolve().then(() => {});
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);
      vi.runAllTimers();

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper>
            <view
              attr="an attr"
            >
              <text>
                <raw-text
                  text="foo"
                />
              </text>
            </view>
          </wrapper>
        </page>
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }

    // remove suspense
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      render(<Comp show={false} />, __root);
      await Promise.resolve().then(() => {});
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        />
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }

    // add suspense back
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      render(<Comp show={true} />, __root);
      await Promise.resolve().then(() => {});
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper>
            <view
              attr="an attr"
            >
              <text>
                <raw-text
                  text="foo"
                />
              </text>
            </view>
          </wrapper>
        </page>
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }
  });

  /**
   * Verifies that `Suspense` still works correctly when the `fallback` prop is
   * not provided.
   *
   * This test is a variation of `should support a host element as a direct child`,
   * but without a fallback. The expected behavior is that nothing is rendered
   * until the promise is resolved.
   *
   * 1. Initial render on the main thread.
   * 2. Background thread starts rendering and encounters the suspended component.
   * 3. Hydration on the main thread renders the `<view>` element inside a
   *    wrapper, but not its suspended children.
   * 4. Since there is no fallback, the UI remains unchanged until the promise
   *    is resolved.
   * 5. The promise is resolved, and the actual children are rendered from the
   *    background thread.
   */
  it('should render nothing when fallback is not provided', async () => {
    const { Suspender, suspended } = createSuspender();

    function Comp() {
      return (
        <Suspense>
          <view attr={`an attr`}>
            <Suspender>
              <text>foo</text>
            </Suspender>
          </view>
        </Suspense>
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper />
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper />
        </page>
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }

    // render children
    {
      globalEnvManager.switchToBackground();
      suspended.resolve();
      lynx.getNativeApp().callLepusMethod.mockClear();
      await Promise.resolve().then(() => {});
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);
      const data = JSON.parse(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).patchList[0].snapshotPatch;
      vi.runAllTimers();

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper>
            <view
              attr="an attr"
            >
              <text>
                <raw-text
                  text="foo"
                />
              </text>
            </view>
          </wrapper>
        </page>
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }
  });

  /**
   * This test case verifies that multiple `Suspense` components can be placed
   * at the same level in the component tree without interfering with each
   * other.
   *
   * It follows these steps:
   * 1. Renders a component with two parallel `Suspense` boundaries.
   * 2. Both `Suspense` boundaries go through their initial lifecycle: hydration
   *    and rendering fallbacks.
   * 3. The first `Suspense` boundary's promise is resolved, and it renders its
   *    children. The test asserts that the second `Suspense` boundary remains
   *    in its fallback state.
   * 4. The second `Suspense` boundary's promise is resolved, and it renders
   *    its children. The test asserts that the first `Suspense` boundary's
   *    content is unaffected.
   */
  it('should not interfere with other parallel suspense components', async () => {
    const { Suspender: Suspender1, suspended: suspended1 } = createSuspender();
    const { Suspender: Suspender2, suspended: suspended2 } = createSuspender();

    function Comp() {
      return (
        <view>
          <Suspense fallback={<text>loading 1</text>}>
            <Suspender1>
              <text>foo</text>
            </Suspender1>
          </Suspense>
          <Suspense fallback={<text>loading 2</text>}>
            <Suspender2>
              <text>bar</text>
            </Suspender2>
          </Suspense>
        </view>
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <wrapper>
              <text>
                <raw-text
                  text="loading 1"
                />
              </text>
            </wrapper>
            <wrapper>
              <text>
                <raw-text
                  text="loading 2"
                />
              </text>
            </wrapper>
          </view>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <wrapper>
              <text>
                <raw-text
                  text="loading 1"
                />
              </text>
            </wrapper>
            <wrapper>
              <text>
                <raw-text
                  text="loading 2"
                />
              </text>
            </wrapper>
          </view>
        </page>
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }

    // render children 1
    {
      globalEnvManager.switchToBackground();
      suspended1.resolve();
      lynx.getNativeApp().callLepusMethod.mockClear();
      await Promise.resolve().then(() => {});
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <wrapper>
              <text>
                <raw-text
                  text="foo"
                />
              </text>
            </wrapper>
            <wrapper>
              <text>
                <raw-text
                  text="loading 2"
                />
              </text>
            </wrapper>
          </view>
        </page>
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }

    // render children 2
    {
      globalEnvManager.switchToBackground();
      suspended2.resolve();
      lynx.getNativeApp().callLepusMethod.mockClear();
      await Promise.resolve().then(() => {});
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <wrapper>
              <text>
                <raw-text
                  text="foo"
                />
              </text>
            </wrapper>
            <wrapper>
              <text>
                <raw-text
                  text="bar"
                />
              </text>
            </wrapper>
          </view>
        </page>
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }
  });

  /**
   * Tests the behavior of nested `Suspense` components.
   *
   * This test verifies that the nearest `Suspense` boundary correctly
   * captures the suspended state.
   *
   * 1. Renders a component with a nested `Suspense` boundary.
   * 2. The inner `Suspense` boundary suspends and renders its fallback.
   * 3. The test asserts that the outer `Suspense` boundary does not show its
   *    fallback, and the inner one does.
   * 4. The promise is resolved, and the final content is rendered.
   */
  it('should handle nested suspense components correctly', async () => {
    const { Suspender, suspended } = createSuspender();

    function Comp() {
      return (
        <Suspense fallback={<text>loading outer</text>}>
          <view>
            <Suspense fallback={<text>loading inner</text>}>
              <Suspender>
                <text>foo</text>
              </Suspender>
            </Suspense>
          </view>
        </Suspense>
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper>
            <view>
              <wrapper>
                <text>
                  <raw-text
                    text="loading inner"
                  />
                </text>
              </wrapper>
            </view>
          </wrapper>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper>
            <view>
              <wrapper>
                <text>
                  <raw-text
                    text="loading inner"
                  />
                </text>
              </wrapper>
            </view>
          </wrapper>
        </page>
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }

    // render children
    {
      globalEnvManager.switchToBackground();
      suspended.resolve();
      lynx.getNativeApp().callLepusMethod.mockClear();
      await Promise.resolve().then(() => {});
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper>
            <view>
              <wrapper>
                <text>
                  <raw-text
                    text="foo"
                  />
                </text>
              </wrapper>
            </view>
          </wrapper>
        </page>
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }
  });

  /**
   * Tests the behavior of `Suspense` when the async task is already
   * completed before the initial render.
   *
   * In this scenario, the fallback content should not be displayed.
   */
  it('should not show fallback if promise is already resolved', async () => {
    const { Suspender, suspended } = createSuspender();

    function Comp() {
      return (
        <Suspense fallback={<text>loading</text>}>
          <Suspender>
            <text>foo</text>
          </Suspender>
        </Suspense>
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper>
            <text>
              <raw-text
                text="loading"
              />
            </text>
          </wrapper>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      await suspended.resolve();
      render(<Comp />, __root);
    }

    // hydrate and render children
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper>
            <text>
              <raw-text
                text="foo"
              />
            </text>
          </wrapper>
        </page>
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }
  });

  /**
   * Tests the interaction between `Suspense` and an Error Boundary.
   *
   * When a child of `Suspense` throws a real error (not a promise), it
   * should be caught by an outer Error Boundary.
   */
  it('should be caught by an error boundary on error', async () => {
    class ErrorBoundary extends Component {
      state = { error: null };

      static getDerivedStateFromError(error) {
        return { error };
      }

      render() {
        if (this.state.error) {
          return <text>Error: {this.state.error.message}</text>;
        }
        return this.props.children;
      }
    }

    function Thrower() {
      throw new Error('test error');
    }

    function Comp() {
      return (
        <ErrorBoundary>
          <Suspense fallback={<text>loading</text>}>
            <Thrower />
          </Suspense>
        </ErrorBoundary>
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        />
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
      await Promise.resolve().then(() => {});
    }

    // hydrate and render error fallback
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="Error: "
            />
            <wrapper>
              <raw-text
                text="test error"
              />
            </wrapper>
          </text>
        </page>
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }
  });

  /**
   * Verifies that `Suspense` can correctly update its children from one
   * element to another after the initial content has been rendered.
   *
   * This test ensures that once a `Suspense` boundary has resolved, subsequent
   * updates to its children are handled correctly without re-triggering the
   * fallback state.
   *
   * 1. Renders a `Suspense` component and waits for it to resolve and show
   *    its initial children.
   * 2. Triggers a re-render with a different set of children.
   * 3. Asserts that the UI correctly updates to display the new children.
   */
  it('should update children from one element to another', async () => {
    const { Suspender, suspended } = createSuspender();

    function Comp({ content }) {
      return (
        <Suspense fallback={<text>loading</text>}>
          <Suspender>{content}</Suspender>
        </Suspense>
      );
    }

    // Initial render with the first element
    {
      __root.__jsx = <Comp content={<text>foo</text>} />;
      renderPage();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper>
            <text>
              <raw-text
                text="loading"
              />
            </text>
          </wrapper>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp content={<text>foo</text>} />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper>
            <text>
              <raw-text
                text="loading"
              />
            </text>
          </wrapper>
        </page>
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }

    // render children
    {
      globalEnvManager.switchToBackground();
      suspended.resolve();
      lynx.getNativeApp().callLepusMethod.mockClear();
      await Promise.resolve().then(() => {});
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper>
            <text>
              <raw-text
                text="foo"
              />
            </text>
          </wrapper>
        </page>
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }

    // Update to the second element
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      render(<Comp content={<text>bar</text>} />, __root);
      await Promise.resolve().then(() => {});
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper>
            <text>
              <raw-text
                text="bar"
              />
            </text>
          </wrapper>
        </page>
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }
  });

  it('should render fallback and content correctly without hydrate', async () => {
    const { Suspender, suspended } = createSuspender();

    function Comp() {
      return (
        <Suspense fallback={<text>loading</text>}>
          <Suspender>
            <text>foo</text>
          </Suspender>
        </Suspense>
      );
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    // render children
    {
      suspended.resolve();
      lynx.getNativeApp().callLepusMethod.mockClear();
      await Promise.resolve().then(() => {});
    }

    // first screen
    {
      globalEnvManager.switchToMainThread();
      __root.__jsx = <Comp />;
      renderPage();
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      globalEnvManager.switchToBackground();
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(lynx.getNativeApp().callLepusMethod).toBeCalledTimes(1);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <wrapper>
            <text>
              <raw-text
                text="foo"
              />
            </text>
          </wrapper>
        </page>
      `);

      // rLynxChange callback
      globalEnvManager.switchToBackground();
      rLynxChange[2]();
      vi.runAllTimers();
    }
  });
});
