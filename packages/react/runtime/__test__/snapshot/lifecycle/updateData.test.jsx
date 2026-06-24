// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Component, render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createProcessData } from '../../../src/core/lynx-data-processors';
import { replaceCommitHook } from '../../../src/snapshot/lifecycle/patch/commit';
import { deinitGlobalSnapshotPatch } from '../../../src/snapshot/lifecycle/patch/snapshotPatch';
import {
  InitDataConsumer,
  InitDataProvider,
  markFirstScreenSyncReady,
  root,
  useInitData,
  withInitDataInState,
} from '../../../src/lynx-api';
import { useState } from '../../../src/index';
import { __root } from '../../../src/root';
import { globalEnvManager } from '../utils/envManager';
import { elementTree, waitSchedule } from '../utils/nativeMethod';

beforeAll(() => {
  replaceCommitHook();
  globalThis.__FlushElementTree = vi.fn();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  deinitGlobalSnapshotPatch();
  elementTree.clear();
  vi.restoreAllMocks();
});

describe('main-thread updatePage initData', () => {
  it('clears initData before resetPageData updates', () => {
    renderPage({ stale: true, msg: 'init' });

    updatePage({ msg: 'reset' }, { resetPageData: true });

    expect(lynx.__initData).toEqual({ msg: 'reset' });
  });

  it('keeps initData unchanged for empty or non-object updatePage data', () => {
    renderPage({ msg: 'init' });
    const previousInitData = lynx.__initData;

    updatePage({});
    updatePage(null);
    updatePage(undefined);
    updatePage('ignored');

    expect(lynx.__initData).toBe(previousInitData);
    expect(lynx.__initData).toEqual({ msg: 'init' });
  });
});

describe('triggerDataUpdated', () => {
  /**
   * This test verifies that updates initiated by `updateCardData` include the `"flushOptions":{"triggerDataUpdated":true}` property.
   * The test follows these steps:
   * 1. **Initial Render (Main Thread):** Renders the component on the main thread with initial data.
   * 2. **Background Render:** Renders the component in the background.
   * 3. **Hydration:** Simulates the hydration process and verifies the initial hydration patch.
   * 4. **Main Thread Update (No-op):** Updates data on the main thread, which should not trigger a re-render immediately.
   * 5. **Background Update:** Calls `updateCardData` to update the component in the background.
   * 6. **Verification:** Asserts that the `rLynxChange` call from the background update contains `"flushOptions":{"triggerDataUpdated":true}`.
   * 7. **Final Update:** Applies the change to the main thread and verifies the UI is updated.
   */
  it('should send triggerDataUpdated when updateData after hydration', async function() {
    function Comp() {
      const initData = useInitData();

      return <text>{initData.msg}</text>;
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage({ msg: 'init' });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="init"
            />
          </text>
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
      expect(lynx.getNativeApp().callLepusMethod.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "rLynxChange",
            {
              "data": "{"patchList":[{"snapshotPatch":[],"id":2}]}",
              "patchOptions": {
                "isHydration": true,
                "pipelineOptions": {
                  "dsl": "reactLynx",
                  "needTimestamps": true,
                  "pipelineID": "pipelineID",
                  "pipelineOrigin": "reactLynxHydrate",
                  "stage": "hydrate",
                },
                "reloadVersion": 0,
              },
            },
            [Function],
          ],
        ]
      `);
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      await waitSchedule();
    }

    // update MT
    {
      globalEnvManager.switchToMainThread();
      updatePage({ msg: 'update' });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="init"
            />
          </text>
        </page>
      `);
    }

    // update BG
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      lynxCoreInject.tt.updateCardData({ msg: 'update' });
      await waitSchedule();

      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls).toMatchInlineSnapshot(
        `
        [
          [
            "rLynxChange",
            {
              "data": "{"patchList":[{"id":3,"snapshotPatch":[3,-3,0,"update"]}],"flushOptions":{"triggerDataUpdated":true}}",
              "patchOptions": {
                "flowIds": [
                  666,
                ],
                "reloadVersion": 0,
              },
            },
            [Function],
          ],
        ]
      `,
      );
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="update"
            />
          </text>
        </page>
      `);
    }
  });

  /**
   * This test verifies that `triggerDataUpdated` is sent only once, even when multiple components
   * call `useInitData`.
   * The test follows these steps:
   * 1. **Initial Render (Main Thread):** Renders a component with multiple children that use `useInitData`.
   * 2. **Background Render:** Renders the same component in the background.
   * 3. **Hydration:** Simulates the hydration process.
   * 4. **Main Thread Update (No-op):** Updates data on the main thread, which should not trigger a re-render immediately.
   * 5. **Background Update:** Calls `updateCardData` to update the component in the background.
   * 6. **Verification:** Asserts that `rLynxChange` is called with `triggerDataUpdated: true` only once in the first call,
   *    and subsequent calls for other components do not include this property.
   */
  it('should send triggerDataUpdated only once when multiple useinitData() hooks are called', async function() {
    function Child() {
      const initData = useInitData();
      return <text>{initData.msg}</text>;
    }

    function ChildWithoutChanges() {
      const initData = useInitData();
      const value = 'value';
      return <text>{value}</text>;
    }

    function Comp() {
      return (
        <view>
          <ChildWithoutChanges />
          <Child />
          <Child />
        </view>
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage({ msg: 'init' });
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
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      await waitSchedule();
    }

    // update MT
    {
      globalEnvManager.switchToMainThread();
      updatePage({ msg: 'update' });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="value"
              />
            </text>
            <text>
              <raw-text
                text="init"
              />
            </text>
            <text>
              <raw-text
                text="init"
              />
            </text>
          </view>
        </page>
      `);
    }

    // update BG
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      lynxCoreInject.tt.updateCardData({ msg: 'update' });
      await waitSchedule();

      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(3);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls).toMatchInlineSnapshot(
        `
        [
          [
            "rLynxChange",
            {
              "data": "{"patchList":[{"id":6}],"flushOptions":{"triggerDataUpdated":true}}",
              "patchOptions": {
                "flowIds": [
                  666,
                ],
                "reloadVersion": 0,
              },
            },
            [Function],
          ],
          [
            "rLynxChange",
            {
              "data": "{"patchList":[{"id":7,"snapshotPatch":[3,-6,0,"update"]}]}",
              "patchOptions": {
                "flowIds": [
                  666,
                ],
                "reloadVersion": 0,
              },
            },
            [Function],
          ],
          [
            "rLynxChange",
            {
              "data": "{"patchList":[{"id":8,"snapshotPatch":[3,-8,0,"update"]}]}",
              "patchOptions": {
                "flowIds": [
                  666,
                ],
                "reloadVersion": 0,
              },
            },
            [Function],
          ],
        ]
      `,
      );
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      for (const rLynxChange of lynx.getNativeApp().callLepusMethod.mock.calls) {
        globalThis[rLynxChange[0]](rLynxChange[1]);
        rLynxChange[2]();
      }
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="value"
              />
            </text>
            <text>
              <raw-text
                text="update"
              />
            </text>
            <text>
              <raw-text
                text="update"
              />
            </text>
          </view>
        </page>
      `);
    }
  });

  /**
   * This test verifies that `triggerDataUpdated` is sent only once, even when multiple components
   * use `InitDataProvider`. This is the class component equivalent of the `useInitData` hook test.
   * The test follows these steps:
   * 1. **Initial Render (Main Thread):** Renders a component with multiple children that use `InitDataProvider`.
   * 2. **Background Render:** Renders the same component in the background.
   * 3. **Hydration:** Simulates the hydration process.
   * 4. **Main Thread Update (No-op):** Updates data on the main thread, which should not trigger a re-render immediately.
   * 5. **Background Update:** Calls `updateCardData` to update the component in the background.
   * 6. **Verification:** Asserts that `rLynxChange` is called with `triggerDataUpdated: true` only once in the first call,
   *    and subsequent calls for other components do not include this property.
   * 7. **Final Update:** Applies the changes to the main thread and verifies the UI is updated.
   */
  it('should send triggerDataUpdated only once when multiple initDataProviders', async function() {
    class Child extends Component {
      render() {
        return (
          <InitDataProvider>
            <InitDataConsumer>
              {(initData) => {
                return <text>{initData.msg}</text>;
              }}
            </InitDataConsumer>
          </InitDataProvider>
        );
      }
    }

    class ChildWithoutChanges extends Component {
      render() {
        return (
          <InitDataProvider>
            <InitDataConsumer>
              {(initData) => {
                return <text>value</text>;
              }}
            </InitDataConsumer>
          </InitDataProvider>
        );
      }
    }

    class Comp extends Component {
      render() {
        return (
          <view>
            <ChildWithoutChanges />
            <Child />
            <Child />
          </view>
        );
      }
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage({ msg: 'init' });
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
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      await waitSchedule();
    }

    // update MT
    {
      globalEnvManager.switchToMainThread();
      updatePage({ msg: 'update' });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="value"
              />
            </text>
            <text>
              <raw-text
                text="init"
              />
            </text>
            <text>
              <raw-text
                text="init"
              />
            </text>
          </view>
        </page>
      `);
    }

    // update BG
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      lynxCoreInject.tt.updateCardData({ msg: 'update' });
      await waitSchedule();

      // duplicated because of https://github.com/preactjs/preact/pull/4724
      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(3 * 2);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls).toMatchInlineSnapshot(
        `
        [
          [
            "rLynxChange",
            {
              "data": "{"patchList":[{"id":11}],"flushOptions":{"triggerDataUpdated":true}}",
              "patchOptions": {
                "flowIds": [
                  666,
                ],
                "reloadVersion": 0,
              },
            },
            [Function],
          ],
          [
            "rLynxChange",
            {
              "data": "{"patchList":[{"id":12}]}",
              "patchOptions": {
                "flowIds": [
                  666,
                ],
                "reloadVersion": 0,
              },
            },
            [Function],
          ],
          [
            "rLynxChange",
            {
              "data": "{"patchList":[{"id":13}]}",
              "patchOptions": {
                "flowIds": [
                  666,
                ],
                "reloadVersion": 0,
              },
            },
            [Function],
          ],
          [
            "rLynxChange",
            {
              "data": "{"patchList":[{"id":14}]}",
              "patchOptions": {
                "reloadVersion": 0,
              },
            },
            [Function],
          ],
          [
            "rLynxChange",
            {
              "data": "{"patchList":[{"id":15,"snapshotPatch":[3,-5,0,"update"]}]}",
              "patchOptions": {
                "reloadVersion": 0,
              },
            },
            [Function],
          ],
          [
            "rLynxChange",
            {
              "data": "{"patchList":[{"id":16,"snapshotPatch":[3,-7,0,"update"]}]}",
              "patchOptions": {
                "reloadVersion": 0,
              },
            },
            [Function],
          ],
        ]
      `,
      );
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      for (const rLynxChange of lynx.getNativeApp().callLepusMethod.mock.calls) {
        globalThis[rLynxChange[0]](rLynxChange[1]);
        rLynxChange[2]();
      }
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="value"
              />
            </text>
            <text>
              <raw-text
                text="update"
              />
            </text>
            <text>
              <raw-text
                text="update"
              />
            </text>
          </view>
        </page>
      `);
    }
  });

  /**
   * This test verifies that `triggerDataUpdated` is sent when using the `withInitDataInState` HOC.
   * The test follows these steps:
   * 1. **Initial Render (Main Thread):** Renders the component wrapped with `withInitDataInState` on the main thread.
   * 2. **Background Render:** Renders the component in the background.
   * 3. **Hydration:** Simulates the hydration process.
   * 4. **Main Thread Update (No-op):** Updates data on the main thread, which should not trigger a re-render immediately.
   * 5. **Background Update:** Calls `updateCardData` to update the component in the background.
   * 6. **Verification:** Asserts that `rLynxChange` is called with `triggerDataUpdated: true`.
   * 7. **Final Update:** Applies the changes to the main thread and verifies the UI is updated.
   */
  it('should send triggerDataUpdated when using withInitDataInState', async function() {
    const willUnmount = vi.fn();

    class App extends Component {
      componentWillUnmount() {
        willUnmount();
      }

      render() {
        return <text>{lynx.__initData.msg}</text>;
      }
    }

    const Comp = withInitDataInState(App);

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage({ msg: 'init' });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="init"
            />
          </text>
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
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      await waitSchedule();
    }

    // update MT
    {
      globalEnvManager.switchToMainThread();
      updatePage({ msg: 'update' });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="init"
            />
          </text>
        </page>
      `);
    }

    // update BG
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      lynxCoreInject.tt.updateCardData({ msg: 'update' });
      await waitSchedule();

      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls).toMatchInlineSnapshot(
        `
        [
          [
            "rLynxChange",
            {
              "data": "{"patchList":[{"id":19,"snapshotPatch":[3,-3,0,"update"]}],"flushOptions":{"triggerDataUpdated":true}}",
              "patchOptions": {
                "flowIds": [
                  666,
                ],
                "reloadVersion": 0,
              },
            },
            [Function],
          ],
        ]
      `,
      );
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      rLynxChange[2]();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="update"
            />
          </text>
        </page>
      `);
    }

    // destroy
    {
      globalEnvManager.switchToBackground();
      render(null, __root);
      expect(willUnmount).toBeCalled();
    }
  });
});

describe('triggerDataUpdated when jsReady is enabled', () => {
  beforeEach(() => {
    globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'jsReady';
  });

  afterEach(() => {
    globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'immediately';
  });

  /**
   * This test verifies that updates initiated by `updateCardData` include the `"flushOptions":{"triggerDataUpdated":true}` property
   * when `__FIRST_SCREEN_SYNC_TIMING__` is set to `jsReady` and an update occurs before hydration.
   * The test follows these steps:
   * 1. **Initial Render (Main Thread):** Renders the component on the main thread with initial data.
   * 2. **Background Render:** Renders the component in the background.
   * 3. **Main Thread Update:** Updates data on the main thread, which should trigger an immediate flush with `triggerDataUpdated: true`.
   * 4. **Background Update:** Calls `updateCardData` to update the component in the background, which should be a no-op as the data is already updated.
   */
  it('should send triggerDataUpdated when updateData before hydration', async function() {
    function Comp() {
      const initData = useInitData();

      return <text>{initData.msg}</text>;
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage({ msg: 'init' });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="init"
            />
          </text>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    // update MT
    {
      globalEnvManager.switchToMainThread();
      __FlushElementTree.mockClear();
      updatePage({ msg: 'update' });

      expect(__FlushElementTree.mock.calls).toMatchInlineSnapshot(`
        [
          [
            <page
              cssId="default-entry-from-native:0"
            >
              <text>
                <raw-text
                  text="update"
                />
              </text>
            </page>,
            {
              "triggerDataUpdated": true,
            },
          ],
        ]
      `);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="update"
            />
          </text>
        </page>
      `);
    }

    // update BG
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      lynxCoreInject.tt.updateCardData({ msg: 'update' });
      await waitSchedule();

      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(0);
    }
  });

  it('should not send triggerDataUpdated when updateData after hydration', async function() {
    function Comp() {
      const initData = useInitData();

      return <text>{initData.msg}</text>;
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage({ msg: 'init' });
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    // LifecycleConstant.firstScreenSyncReady (jsReady mode)
    {
      globalEnvManager.switchToMainThread();
      rLynxFirstScreenSyncReady();
    }

    // hydrate
    {
      globalEnvManager.switchToBackground();
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      await waitSchedule();
    }

    // update MT
    {
      globalEnvManager.switchToMainThread();
      globalThis.__FlushElementTree.mockClear();

      updatePage({ msg: 'update' });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="init"
            />
          </text>
        </page>
      `);
      expect(globalThis.__FlushElementTree.mock.calls).toMatchInlineSnapshot(`
        [
          [
            <page
              cssId="default-entry-from-native:0"
            >
              <text>
                <raw-text
                  text="init"
                />
              </text>
            </page>,
            {},
          ],
        ]
      `);
    }
  });

  /**
   * Reproduces the `withInitDataInState` main-thread staleness bug.
   *
   * `withInitDataInState` injects `lynx.__initData` into the class component's state only in
   * the constructor, and its `onDataChanged` listener is gated to the background thread. On
   * the main thread, `renderToString` reuses the same class instance across an `updatePage`
   * re-render (the constructor never re-runs), so the state stays frozen at the data injected
   * on first mount. When the main thread re-renders before hydration (an `updatePage` while
   * `__FIRST_SCREEN_SYNC_TIMING__` is `'jsReady'`), the stale state surfaces as a stale render.
   */
  it('should refresh withInitDataInState state on a main-thread updatePage re-render', async function() {
    class App extends Component {
      render() {
        // reads from state (what `withInitDataInState` injects), like real pages do
        return <text>{this.state.msg}</text>;
      }
    }

    const Comp = withInitDataInState(App);

    // first screen renders cache data into the injected state (jsReady mode: not synced yet)
    {
      __root.__jsx = <Comp />;
      renderPage({ msg: 'cache' });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="cache"
            />
          </text>
        </page>
      `);
    }

    // the second render: the main thread re-renders with real data via `updatePage` before hydration.
    // The injected state must refresh to the new data — otherwise the render is stale.
    {
      updatePage({ msg: 'real' });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="real"
            />
          </text>
        </page>
      `);
    }
  });

  /**
   * Verifies that `withInitDataInState` composes with — and does not drop — the wrapped
   * component's own `getDerivedStateFromProps` on the main thread. The wrapped
   * `getDerivedStateFromProps` keeps running on each `updatePage` re-render and sees the
   * freshened `initData`, while the injected `initData` itself is also refreshed.
   */
  it('should keep the wrapped getDerivedStateFromProps working on a main-thread updatePage re-render', async function() {
    class App extends Component {
      static getDerivedStateFromProps(props, state) {
        // derives from the injected initData in state, proving it sees the fresh data
        return { upper: state.msg?.toUpperCase() };
      }

      render() {
        return <text>{`${this.state.msg}|${this.state.upper}`}</text>;
      }
    }

    const Comp = withInitDataInState(App);

    {
      __root.__jsx = <Comp />;
      renderPage({ msg: 'cache' });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="cache|CACHE"
            />
          </text>
        </page>
      `);
    }

    {
      updatePage({ msg: 'real' });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="real|REAL"
            />
          </text>
        </page>
      `);
    }
  });
});

describe('flush pending `renderComponent` before hydrate', () => {
  beforeEach(() => {
    globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'jsReady';
  });

  afterEach(() => {
    globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'immediately';
  });

  it('`updateCardData` before hydrate should take effects', async function() {
    function Comp() {
      const initData = useInitData();

      return <text>{initData.msg}</text>;
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage({ msg: 'init' });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="init"
            />
          </text>
        </page>
      `);
    }

    // main thread updatePage
    {
      __root.__jsx = <Comp />;
      updatePage({ msg: 'update' });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="update"
            />
          </text>
        </page>
      `);
    }

    // reset back
    // lynx.__initData is shared between main thread and background IN TEST
    // so we should reset it
    lynx.__initData.msg = 'init';

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp />, __root);
    }

    // LifecycleConstant.firstScreenSyncReady (jsReady mode)
    {
      globalEnvManager.switchToMainThread();
      rLynxFirstScreenSyncReady();
    }

    // background updateCardData
    {
      globalEnvManager.switchToBackground();

      const spy = vi.spyOn(Component.prototype, 'setState');
      lynxCoreInject.tt.updateCardData({ msg: 'update' });
      expect(spy).toBeCalled();
      spy.mockRestore();
    }

    // hydrate
    {
      globalEnvManager.switchToBackground();
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(rLynxChange[1]).toMatchInlineSnapshot(`
        {
          "data": "{"patchList":[{"snapshotPatch":[],"id":27}]}",
          "patchOptions": {
            "isHydration": true,
            "pipelineOptions": {
              "dsl": "reactLynx",
              "needTimestamps": true,
              "pipelineID": "pipelineID",
              "pipelineOrigin": "reactLynxHydrate",
              "stage": "hydrate",
            },
            "reloadVersion": 0,
          },
        }
      `);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="update"
            />
          </text>
        </page>
      `);
    }
  });

  it('throw in process will not prevent hydrate', async function() {
    let _setShouldThrow;
    function Comp({ isBackground }) {
      const [shouldThrow, setShouldThrow] = useState();

      _setShouldThrow = setShouldThrow;

      if (shouldThrow) {
        throw new Error('initData.shouldThrow is true');
      }

      return <text>isBackground: {`${isBackground}`}</text>;
    }

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage({});
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="isBackground: "
            />
            <wrapper>
              <raw-text
                text="undefined"
              />
            </wrapper>
          </text>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      render(<Comp isBackground={true} />, __root);
      _setShouldThrow(true);
    }

    // LifecycleConstant.firstScreenSyncReady (jsReady mode)
    {
      globalEnvManager.switchToMainThread();
      rLynxFirstScreenSyncReady();
    }

    // hydrate
    {
      globalEnvManager.switchToBackground();
      // LifecycleConstant.firstScreen
      const spy = vi.spyOn(lynx, 'reportError');
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(spy.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [Error: initData.shouldThrow is true],
          ],
        ]
      `);
      spy.mockRestore();
    }

    // rLynxChange
    {
      globalEnvManager.switchToMainThread();
      globalThis.__OnLifecycleEvent.mockClear();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(rLynxChange[1]).toMatchInlineSnapshot(`
        {
          "data": "{"patchList":[{"snapshotPatch":[3,-3,0,"true"],"id":29}]}",
          "patchOptions": {
            "isHydration": true,
            "pipelineOptions": {
              "dsl": "reactLynx",
              "needTimestamps": true,
              "pipelineID": "pipelineID",
              "pipelineOrigin": "reactLynxHydrate",
              "stage": "hydrate",
            },
            "reloadVersion": 0,
          },
        }
      `);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="isBackground: "
            />
            <wrapper>
              <raw-text
                text="true"
              />
            </wrapper>
          </text>
        </page>
      `);
    }
  });
});

describe('firstScreenSyncTiming - manual', () => {
  beforeEach(() => {
    globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'manual';
  });

  afterEach(() => {
    globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'immediately';
  });

  /**
   * This test verifies the `manual` mode: the main thread keeps the UI control after the
   * first screen and responds to `updateData` __synchronously__, until the user calls
   * `markFirstScreenSyncReady()` on the main thread. Only then is the first screen
   * (`SnapshotInstance` tree) synced to the background for hydration.
   * The test follows these steps:
   * 1. **Initial Render (Main Thread):** Renders the component on the main thread, no `firstScreen` is sent.
   * 2. **Main Thread Update:** Updates data on the main thread, which is applied synchronously
   *    and still does NOT trigger the first screen sync.
   * 3. **Background Render:** Renders the component in the background, which should NOT notify
   *    the main thread with `rLynxJSReady`; calling `markFirstScreenSyncReady()` on the
   *    background thread is forwarded to the main thread via `rLynxFirstScreenSyncReady`
   *    (here we only assert the forward, without dispatching it, so the main-thread render
   *    path below is exercised; the full forwarded flow is covered by a dedicated test).
   * 4. **Mark Ready (Main Thread, during render):** Updates data again; the component marks
   *    ready during the synchronous main-thread re-render, and the sync is deferred until the
   *    re-render completes (the half-rendered tree must not be synced).
   * 5. **Hydration:** The background receives `firstScreen` and hydrates; the hydration patch is
   *    applied to the main thread.
   * 6. **Main Thread Update (No-op):** Updates data on the main thread again, which is no longer
   *    processed by the main thread.
   * 7. **Mark Ready Again (No-op):** Calls `markFirstScreenSyncReady()` again, which has no effect.
   */
  it('should sync first screen after markFirstScreenSyncReady during updateData render', async function() {
    function Comp() {
      const initData = useInitData();

      if (initData.ready) {
        markFirstScreenSyncReady();
      }

      return <text>{initData.msg}</text>;
    }

    // main thread render
    {
      globalThis.__OnLifecycleEvent.mockClear();
      __root.__jsx = <Comp />;
      renderPage({ msg: 'init' });
      // the first screen is NOT synced at `renderPage`
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
    }

    // main thread updatePage: processed synchronously, still no first screen sync
    {
      globalThis.__FlushElementTree.mockClear();
      updatePage({ msg: 'update' });
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="update"
            />
          </text>
        </page>
      `);
      expect(globalThis.__FlushElementTree.mock.calls[0][1]).toMatchInlineSnapshot(`
        {
          "triggerDataUpdated": true,
        }
      `);
    }

    // background render: should NOT notify the main thread with `rLynxJSReady`.
    // `markFirstScreenSyncReady` on the background thread is forwarded to the main
    // thread via `rLynxFirstScreenSyncReady`. We assert the forward but do NOT
    // dispatch it to the main thread, so the mark does not take effect here and the
    // main-thread render path below is exercised instead.
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      root.render(<Comp />, __root);
      markFirstScreenSyncReady();
      expect(lynx.getNativeApp().callLepusMethod.mock.calls.map(call => call[0])).toMatchInlineSnapshot(`
        [
          "rLynxFirstScreenSyncReady",
        ]
      `);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // main thread updatePage marking ready: the component calls
    // `markFirstScreenSyncReady()` during the re-render, and the first screen
    // is synced right after the re-render completes
    {
      globalEnvManager.switchToMainThread();
      globalThis.__FlushElementTree.mockClear();
      updatePage({ msg: 'update2', ready: true });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="update2"
            />
          </text>
        </page>
      `);
      expect(globalThis.__FlushElementTree.mock.calls[0][1]).toMatchInlineSnapshot(`
        {
          "triggerDataUpdated": true,
        }
      `);
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxFirstScreen",
              {
                "firstScreenEventIdSwap": {
                  "-1": -4,
                  "-2": -5,
                  "-3": -6,
                  "-4": -7,
                  "-5": -8,
                  "-6": -9,
                },
                "root": "{"id":-7,"type":"root","children":[{"id":-8,"type":"__snapshot_a94a8_test_13","children":[{"id":-9,"type":null,"values":["update2"]}]}]}",
              },
            ],
          ],
        ]
      `);
    }

    // hydrate
    {
      globalEnvManager.switchToBackground();
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls.map(call => call[0])).toMatchInlineSnapshot(`
        [
          "rLynxChange",
        ]
      `);
    }

    // rLynxChange: apply the hydration patch to the main thread
    {
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      await waitSchedule();
    }

    // main thread updatePage after the first screen is synced:
    // no longer processed by the main thread
    {
      globalThis.__OnLifecycleEvent.mockClear();
      globalThis.__FlushElementTree.mockClear();
      updatePage({ msg: 'update3' });
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="update"
            />
          </text>
        </page>
      `);
      expect(globalThis.__FlushElementTree.mock.calls[0][1]).toMatchInlineSnapshot(`{}`);
    }

    // markFirstScreenSyncReady again: no effect
    {
      markFirstScreenSyncReady();
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
    }
  });

  /**
   * This test verifies that a ready mark set BEFORE `renderPage` (e.g. inside
   * `defaultDataProcessor`, which runs before the first render) is preserved by
   * `renderPage` and the first screen is synced once the render completes.
   */
  it('should keep a ready mark set before renderPage (e.g. in defaultDataProcessor)', async function() {
    function Comp() {
      const initData = useInitData();

      return <text>{initData.msg}</text>;
    }

    // `markFirstScreenSyncReady()` invoked before `renderPage`, simulating a call
    // from `defaultDataProcessor`. The tree is not ready yet, so it does not sync.
    {
      globalThis.__OnLifecycleEvent.mockClear();
      markFirstScreenSyncReady();
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
    }

    // `renderPage` must NOT clear the earlier mark; the first screen is synced
    // once the tree is ready.
    {
      __root.__jsx = <Comp />;
      renderPage({ msg: 'init' });
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxFirstScreen",
              {
                "firstScreenEventIdSwap": {},
                "root": "{"id":-1,"type":"root","children":[{"id":-2,"type":"__snapshot_a94a8_test_14","children":[{"id":-3,"type":null,"values":["init"]}]}]}",
              },
            ],
          ],
        ]
      `);
    }
  });

  /**
   * This test verifies that when `markFirstScreenSyncReady()` is called during the
   * first-screen render (before the tree is ready), the mark is kept and the first
   * screen is synced right after `renderPage` completes.
   */
  it('should sync first screen at renderPage when marked ready during render', async function() {
    function Comp() {
      const initData = useInitData();

      // mark ready during the first-screen render, before the tree is ready
      markFirstScreenSyncReady();

      return <text>{initData.msg}</text>;
    }

    // main thread render: the first screen is synced once the tree is ready
    {
      globalThis.__OnLifecycleEvent.mockClear();
      __root.__jsx = <Comp />;
      renderPage({ msg: 'init' });
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxFirstScreen",
              {
                "firstScreenEventIdSwap": {},
                "root": "{"id":-1,"type":"root","children":[{"id":-2,"type":"__snapshot_a94a8_test_15","children":[{"id":-3,"type":null,"values":["init"]}]}]}",
              },
            ],
          ],
        ]
      `);
    }
  });

  /**
   * This test verifies that when `markFirstScreenSyncReady()` is called on the main
   * thread while the first-screen tree is already rendered (e.g. from a main thread
   * script), the first screen is synced immediately.
   */
  it('should sync first screen immediately when marked ready after render', async function() {
    function Comp() {
      const initData = useInitData();

      return <text>{initData.msg}</text>;
    }

    // main thread render
    {
      globalThis.__OnLifecycleEvent.mockClear();
      __root.__jsx = <Comp />;
      renderPage({ msg: 'init' });
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
    }

    // mark ready on the main thread: the tree is already rendered, sync immediately
    {
      markFirstScreenSyncReady();
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxFirstScreen",
              {
                "firstScreenEventIdSwap": {},
                "root": "{"id":-1,"type":"root","children":[{"id":-2,"type":"__snapshot_a94a8_test_16","children":[{"id":-3,"type":null,"values":["init"]}]}]}",
              },
            ],
          ],
        ]
      `);
    }
  });

  /**
   * This test verifies that `markFirstScreenSyncReady()` called on the background thread
   * is forwarded to the main thread via `rLynxFirstScreenSyncReady`, and the actual sync
   * happens on the main thread once the forwarded message is processed there.
   */
  it('should sync first screen when marked ready from the background thread', async function() {
    function Comp() {
      const initData = useInitData();

      return <text>{initData.msg}</text>;
    }

    // main thread render: the first screen is NOT synced at `renderPage`
    {
      globalThis.__OnLifecycleEvent.mockClear();
      __root.__jsx = <Comp />;
      renderPage({ msg: 'init' });
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
    }

    // background render + mark ready: forwarded to the main thread, NOT synced here
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      root.render(<Comp />, __root);
      markFirstScreenSyncReady();
      expect(lynx.getNativeApp().callLepusMethod.mock.calls.map(call => call[0])).toMatchInlineSnapshot(`
        [
          "rLynxFirstScreenSyncReady",
        ]
      `);
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
    }

    // main thread receives the forwarded `rLynxFirstScreenSyncReady`: the tree is
    // already ready, so the first screen is synced immediately
    {
      globalEnvManager.switchToMainThread();
      const rLynxFirstScreenSyncReady = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxFirstScreenSyncReady[0]](rLynxFirstScreenSyncReady[1]);
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxFirstScreen",
              {
                "firstScreenEventIdSwap": {},
                "root": "{"id":-1,"type":"root","children":[{"id":-2,"type":"__snapshot_a94a8_test_17","children":[{"id":-3,"type":null,"values":["init"]}]}]}",
              },
            ],
          ],
        ]
      `);
    }
  });

  /**
   * Regression test: `markFirstScreenSyncReady()` called inside `defaultDataProcessor`.
   *
   * The native side runs `defaultDataProcessor` (via `globalThis.processData`) as a
   * separate call BEFORE `updatePage`. After the first `renderPage`, the previous tree
   * is still latched ready, so a naive implementation would sync that STALE tree the
   * moment the mark is made, and the following `updatePage` would then skip its
   * main-thread render entirely — the new data would never render on the main thread
   * (it would only re-render later on the background thread after hydration).
   *
   * The mark made during data processing must be deferred so the new data renders on
   * the main thread first, and only then syncs.
   */
  it('should defer a markFirstScreenSyncReady made inside defaultDataProcessor until the data renders', async function() {
    function Comp() {
      const initData = useInitData();

      return <text>{initData.msg}</text>;
    }

    // first screen renders cache data: the tree is ready but NOT synced (manual mode)
    {
      globalThis.__OnLifecycleEvent.mockClear();
      __root.__jsx = <Comp />;
      renderPage({ msg: 'cache' });
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();
    }

    // the "二刷": native runs the default data processor, which marks ready inside it.
    // Although the previous tree is still latched ready, the mark must be deferred —
    // a re-render of this data is imminent — so NO sync happens here.
    globalThis.__EXTRACT_STR__ = false;
    const processData = createProcessData({
      defaultDataProcessor(rawData) {
        markFirstScreenSyncReady();
        return rawData;
      },
    });
    {
      globalThis.__OnLifecycleEvent.mockClear();
      const processed = processData({ msg: 'real' });
      expect(globalThis.__OnLifecycleEvent).not.toBeCalled();

      // native then calls `updatePage` with the processed data: it renders on the
      // main thread and only THEN syncs the new tree (not the stale cache tree)
      globalThis.__FlushElementTree.mockClear();
      updatePage(processed);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <text>
            <raw-text
              text="real"
            />
          </text>
        </page>
      `);
      expect(globalThis.__OnLifecycleEvent.mock.calls).toMatchInlineSnapshot(`
        [
          [
            [
              "rLynxFirstScreen",
              {
                "firstScreenEventIdSwap": {
                  "-1": -4,
                  "-2": -5,
                  "-3": -6,
                },
                "root": "{"id":-4,"type":"root","children":[{"id":-5,"type":"__snapshot_a94a8_test_18","children":[{"id":-6,"type":null,"values":["real"]}]}]}",
              },
            ],
          ],
        ]
      `);
    }
  });
});
