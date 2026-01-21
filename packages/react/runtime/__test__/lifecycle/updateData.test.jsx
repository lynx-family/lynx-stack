// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Component, render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { replaceCommitHook } from '../../src/lifecycle/patch/commit';
import { deinitGlobalSnapshotPatch } from '../../src/lifecycle/patch/snapshotPatch';
import { InitDataConsumer, InitDataProvider, useInitData, withInitDataInState } from '../../src/lynx-api';
import { useState } from '../../src/index';
import { __root } from '../../src/root';
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
              "data": "{"patchList":[{"id":7,"snapshotPatch":[3,-7,0,"update"]}]}",
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
              "data": "{"patchList":[{"id":15,"snapshotPatch":[3,-6,0,"update"]}]}",
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

    // LifecycleConstant.jsReady
    {
      globalEnvManager.switchToMainThread();
      rLynxJSReady();
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

    // LifecycleConstant.jsReady
    {
      globalEnvManager.switchToMainThread();
      rLynxJSReady();
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

    // LifecycleConstant.jsReady
    {
      globalEnvManager.switchToMainThread();
      rLynxJSReady();
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
