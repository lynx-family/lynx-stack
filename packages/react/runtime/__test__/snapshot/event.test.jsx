/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { render } from 'preact';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { delayedLifecycleEvents } from '../../src/lifecycle/event/delayLifecycleEvents';
import { takeGlobalSnapshotPatch } from '../../src/lifecycle/patch/snapshotPatch';
import { snapshotPatchApply } from '../../src/lifecycle/patch/snapshotPatchApply';
import { injectUpdateMainThread } from '../../src/lifecycle/patch/updateMainThread';
import { injectTt } from '../../src/lynx/tt';
import { root } from '../../src/lynx-api';
import { CHILDREN } from '../../src/renderToOpcodes/constants';
import { __root } from '../../src/root';
import { backgroundSnapshotInstanceManager, setupPage } from '../../src/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { elementTree } from '../utils/nativeMethod';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
});

afterEach(() => {
  vi.restoreAllMocks();
  elementTree.clear();
});

describe('eventUpdate', () => {
  it('basic & throw', async function() {
    const handleTap1 = vi.fn().mockImplementation(() => {
      throw new Error('error');
    });
    const handleTap2 = vi.fn();
    function Comp() {
      return (
        <view>
          <text bindtap={handleTap1}>1</text>
          <text bindtap={handleTap2}>1</text>
        </view>
      );
    }

    __root.__jsx = <Comp />;
    renderPage();
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text
            event={
              {
                "bindEvent:tap": "-2:0:",
              }
            }
          >
            <raw-text
              text="1"
            />
          </text>
          <text
            event={
              {
                "bindEvent:tap": "-2:1:",
              }
            }
          >
            <raw-text
              text="1"
            />
          </text>
        </view>
      </page>
    `);

    globalEnvManager.switchToBackground();
    render(<Comp />, __root);

    // LifecycleConstant.firstScreen
    {
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "rLynxChange",
            {
              "data": "{"patchList":[{"snapshotPatch":[],"id":1}]}",
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

    lynxCoreInject.tt.publishEvent('-2:1:', 'data');
    expect(handleTap1).toHaveBeenCalledTimes(0);
    expect(handleTap2).toHaveBeenCalledTimes(1);
    expect(handleTap2).toHaveBeenCalledWith('data');
    handleTap2.mockClear();

    const reportError = lynx.reportError;
    lynx.reportError = vi.fn();
    lynxCoreInject.tt.publishEvent('-2:0:', 'data');
    expect(handleTap1).toHaveBeenCalledTimes(1);
    expect(lynx.reportError).toHaveBeenCalledTimes(1);
    expect(lynx.reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'error',
        stack: expect.stringContaining('error'),
      }),
    );
    handleTap1.mockClear();
    lynx.reportError = reportError;
  });

  it('add', async function() {
    let patch;
    let handleTap1 = undefined;
    let handleTap2 = null;
    function Comp() {
      return (
        <view>
          <text bindtap={handleTap1}>1</text>
          <text bindtap={handleTap2}>1</text>
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
            <text>
              <raw-text
                text="1"
              />
            </text>
            <text>
              <raw-text
                text="1"
              />
            </text>
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

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="1"
              />
            </text>
            <text>
              <raw-text
                text="1"
              />
            </text>
          </view>
        </page>
      `);
    }

    globalEnvManager.switchToBackground();
    handleTap1 = vi.fn();
    handleTap2 = vi.fn();
    render(<Comp />, __root);
    patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`
      [
        3,
        -2,
        0,
        1,
        3,
        -2,
        1,
        1,
      ]
    `);
    globalEnvManager.switchToMainThread();
    snapshotPatchApply(patch);
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text
            event={
              {
                "bindEvent:tap": "-2:0:",
              }
            }
          >
            <raw-text
              text="1"
            />
          </text>
          <text
            event={
              {
                "bindEvent:tap": "-2:1:",
              }
            }
          >
            <raw-text
              text="1"
            />
          </text>
        </view>
      </page>
    `);
    globalEnvManager.switchToBackground();

    lynxCoreInject.tt.publishEvent('-2:1:', 'data');
    expect(handleTap1).toHaveBeenCalledTimes(0);
    expect(handleTap2).toHaveBeenCalledTimes(1);
    expect(handleTap2).toHaveBeenCalledWith('data');
  });

  it('insert element', async function() {
    let patch;
    let handleTap1 = vi.fn();
    let show = false;
    function Comp() {
      return (
        <view>
          {show ? <text bindtap={handleTap1}>1</text> : null}
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
          <view />
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
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"snapshotPatch":[],"id":3}]}"`,
      );

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    globalEnvManager.switchToBackground();

    show = true;
    render(<Comp />, __root);
    patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`
      [
        0,
        "__Card__:__snapshot_a94a8_test_4",
        3,
        4,
        3,
        [
          1,
        ],
        1,
        -2,
        3,
        undefined,
      ]
    `);
    globalEnvManager.switchToMainThread();
    snapshotPatchApply(patch);
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text
            event={
              {
                "bindEvent:tap": "3:0:",
              }
            }
          >
            <raw-text
              text="1"
            />
          </text>
        </view>
      </page>
    `);
    globalEnvManager.switchToBackground();

    lynxCoreInject.tt.publishEvent('3:0:', 'data');
    expect(handleTap1).toHaveBeenCalledTimes(1);
    expect(handleTap1).toHaveBeenCalledWith('data');
  });

  it('update', () => {
    let patch;
    let handleTap1 = vi.fn();
    let handleTap2 = vi.fn();
    function Comp() {
      return (
        <view>
          <text bindtap={handleTap1}>1</text>
          <text bindtap={handleTap2}>1</text>
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
            <text
              event={
                {
                  "bindEvent:tap": "-2:0:",
                }
              }
            >
              <raw-text
                text="1"
              />
            </text>
            <text
              event={
                {
                  "bindEvent:tap": "-2:1:",
                }
              }
            >
              <raw-text
                text="1"
              />
            </text>
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
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"snapshotPatch":[],"id":4}]}"`,
      );

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    globalEnvManager.switchToBackground();
    lynxCoreInject.tt.publishEvent('-2:0:', 'data1');
    expect(handleTap2).toHaveBeenCalledTimes(0);
    expect(handleTap1).toHaveBeenCalledTimes(1);
    expect(handleTap1).toHaveBeenCalledWith('data1');

    lynxCoreInject.tt.publishEvent('-2:1:', 'data2');
    expect(handleTap1).toHaveBeenCalledTimes(1);
    expect(handleTap2).toHaveBeenCalledTimes(1);
    expect(handleTap2).toHaveBeenCalledWith('data2');

    handleTap1 = vi.fn();
    handleTap2 = vi.fn();
    render(<Comp />, __root);
    patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`[]`);
    globalEnvManager.switchToMainThread();
    snapshotPatchApply(patch);
    globalEnvManager.switchToBackground();

    lynxCoreInject.tt.publishEvent('-2:0:', 'data3');
    expect(handleTap2).toHaveBeenCalledTimes(0);
    expect(handleTap1).toHaveBeenCalledTimes(1);
    expect(handleTap1).toHaveBeenCalledWith('data3');

    lynxCoreInject.tt.publishEvent('-2:1:', 'data4');
    expect(handleTap1).toHaveBeenCalledTimes(1);
    expect(handleTap2).toHaveBeenCalledTimes(1);
    expect(handleTap2).toHaveBeenCalledWith('data4');
  });

  it('update before hydration', () => {
    let patch;
    let handleTap1 = vi.fn();
    let handleTap2 = undefined;
    function Comp() {
      return (
        <view>
          <text bindtap={handleTap1}>1</text>
          <text bindtap={handleTap2}>1</text>
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
            <text
              event={
                {
                  "bindEvent:tap": "-2:0:",
                }
              }
            >
              <raw-text
                text="1"
              />
            </text>
            <text>
              <raw-text
                text="1"
              />
            </text>
          </view>
        </page>
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      handleTap1 = vi.fn();
      handleTap2 = vi.fn();
      render(<Comp />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"snapshotPatch":[3,-2,1,"-2:1:"],"id":5}]}"`,
      );

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    globalEnvManager.switchToBackground();

    lynxCoreInject.tt.publishEvent('-2:0:', 'data1');
    expect(handleTap2).toHaveBeenCalledTimes(0);
    expect(handleTap1).toHaveBeenCalledTimes(1);
    expect(handleTap1).toHaveBeenCalledWith('data1');

    lynxCoreInject.tt.publishEvent('-2:1:', 'data2');
    expect(handleTap1).toHaveBeenCalledTimes(1);
    expect(handleTap2).toHaveBeenCalledTimes(1);
    expect(handleTap2).toHaveBeenCalledWith('data2');
  });

  it('remove', () => {
    let patch;
    let handleTap1 = vi.fn();
    let handleTap2 = vi.fn();
    function Comp() {
      return (
        <view>
          <text bindtap={handleTap1}>1</text>
          <text bindtap={handleTap2}>1</text>
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
            <text
              event={
                {
                  "bindEvent:tap": "-2:0:",
                }
              }
            >
              <raw-text
                text="1"
              />
            </text>
            <text
              event={
                {
                  "bindEvent:tap": "-2:1:",
                }
              }
            >
              <raw-text
                text="1"
              />
            </text>
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
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"snapshotPatch":[],"id":6}]}"`,
      );

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    globalEnvManager.switchToBackground();
    handleTap1 = undefined;
    handleTap2 = null;
    render(<Comp />, __root);
    patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`
      [
        3,
        -2,
        0,
        undefined,
        3,
        -2,
        1,
        null,
      ]
    `);
    globalEnvManager.switchToMainThread();
    snapshotPatchApply(patch);
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text
            event={{}}
          >
            <raw-text
              text="1"
            />
          </text>
          <text
            event={{}}
          >
            <raw-text
              text="1"
            />
          </text>
        </view>
      </page>
    `);
  });
});

describe('getValueBySign', () => {
  it('should throw error', () => {
    expect(() => {
      backgroundSnapshotInstanceManager.getValueBySign(undefined);
    }).toThrowError('Invalid ctx format: undefined');

    expect(() => {
      backgroundSnapshotInstanceManager.getValueBySign('');
    }).toThrowError('Invalid ctx format: ');

    expect(() => {
      backgroundSnapshotInstanceManager.getValueBySign('1');
    }).toThrowError('Invalid ctx format: 1');

    expect(() => {
      backgroundSnapshotInstanceManager.getValueBySign('10:20');
    }).not.toThrowError();
  });
});

describe('event in spread', () => {
  it('add', async function() {
    let patch;
    let spread1 = {};
    let spread2 = {};
    let handleTap1 = vi.fn();
    let handleTap2 = vi.fn();
    let handleTouchStart = vi.fn();
    function Comp() {
      return (
        <view>
          <text {...spread1}>1</text>
          <text bindtouchstart={handleTouchStart} {...spread2}>2</text>
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
            <text>
              <raw-text
                text="1"
              />
            </text>
            <text
              event={
                {
                  "bindEvent:touchstart": "-2:1:bindtouchstart",
                }
              }
            >
              <raw-text
                text="2"
              />
            </text>
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
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"snapshotPatch":[],"id":7}]}"`,
      );

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);

      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text>
              <raw-text
                text="1"
              />
            </text>
            <text
              event={
                {
                  "bindEvent:touchstart": "-2:1:bindtouchstart",
                }
              }
            >
              <raw-text
                text="2"
              />
            </text>
          </view>
        </page>
      `);
    }

    globalEnvManager.switchToBackground();
    lynxCoreInject.tt.publishEvent('-2:1:bindtouchstart', 'data');
    expect(handleTouchStart).toHaveBeenCalledTimes(1);
    expect(handleTouchStart).toHaveBeenCalledWith('data');
    handleTouchStart.mockReset();

    spread1 = { bindtap: handleTap1 };
    spread2 = { bindtap: handleTap2 };
    render(<Comp />, __root);
    patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`
      [
        3,
        -2,
        0,
        {
          "bindtap": "-2:0:bindtap",
        },
        3,
        -2,
        1,
        {
          "bindtap": "-2:1:bindtap",
          "bindtouchstart": "-2:1:bindtouchstart",
        },
      ]
    `);
    globalEnvManager.switchToMainThread();
    snapshotPatchApply(patch);
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text
            event={
              {
                "bindEvent:tap": "-2:0:bindtap",
              }
            }
          >
            <raw-text
              text="1"
            />
          </text>
          <text
            event={
              {
                "bindEvent:tap": "-2:1:bindtap",
                "bindEvent:touchstart": "-2:1:bindtouchstart",
              }
            }
          >
            <raw-text
              text="2"
            />
          </text>
        </view>
      </page>
    `);
    globalEnvManager.switchToBackground();

    lynxCoreInject.tt.publishEvent('-2:0:bindtap', 'data');
    expect(handleTap1).toHaveBeenCalledTimes(1);
    expect(handleTap1).toHaveBeenCalledWith('data');

    lynxCoreInject.tt.publishEvent('-2:1:bindtap', 'data');
    expect(handleTap2).toHaveBeenCalledTimes(1);
    expect(handleTap2).toHaveBeenCalledWith('data');

    lynxCoreInject.tt.publishEvent('-2:1:bindtouchstart', 'data');
    expect(handleTouchStart).toHaveBeenCalledTimes(1);
    expect(handleTouchStart).toHaveBeenCalledWith('data');

    spread1 = { bindtap: vi.fn() };
    spread2 = { bindtap: vi.fn() };
    render(<Comp />, __root);
    patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`[]`);

    spread1 = { bindtap: null };
    spread2 = {};
    render(<Comp />, __root);
    patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`
      [
        3,
        -2,
        0,
        {
          "bindtap": null,
        },
        3,
        -2,
        1,
        {
          "bindtouchstart": "-2:1:bindtouchstart",
        },
      ]
    `);

    globalEnvManager.switchToMainThread();
    snapshotPatchApply(patch);
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text
            event={{}}
          >
            <raw-text
              text="1"
            />
          </text>
          <text
            event={
              {
                "bindEvent:touchstart": "-2:1:bindtouchstart",
              }
            }
          >
            <raw-text
              text="2"
            />
          </text>
        </view>
      </page>
    `);
  });

  it('insert element', async function() {
    let patch;
    let show = false;
    let handleTap1 = vi.fn();
    let spread1 = { bindtap: handleTap1 };
    function Comp() {
      return (
        <view>
          {show ? <text {...spread1}>1</text> : null}
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
          <view />
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
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0][1].data).toMatchInlineSnapshot(
        `"{"patchList":[{"snapshotPatch":[],"id":8}]}"`,
      );

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    globalEnvManager.switchToBackground();
    show = true;
    render(<Comp />, __root);
    patch = takeGlobalSnapshotPatch();
    expect(patch).toMatchInlineSnapshot(`
      [
        0,
        "__Card__:__snapshot_a94a8_test_10",
        3,
        4,
        3,
        [
          {
            "bindtap": "3:0:bindtap",
          },
        ],
        1,
        -2,
        3,
        undefined,
      ]
    `);
    globalEnvManager.switchToMainThread();
    snapshotPatchApply(patch);
    expect(__root.__element_root).toMatchInlineSnapshot(`
      <page
        cssId="default-entry-from-native:0"
      >
        <view>
          <text
            event={
              {
                "bindEvent:tap": "3:0:bindtap",
              }
            }
          >
            <raw-text
              text="1"
            />
          </text>
        </view>
      </page>
    `);
    globalEnvManager.switchToBackground();

    lynxCoreInject.tt.publishEvent('3:0:bindtap', 'data');
    expect(handleTap1).toHaveBeenCalledTimes(1);
    expect(handleTap1).toHaveBeenCalledWith('data');
  });
});

describe('event when firstScreenSyncTiming is jsReady', () => {
  beforeAll(() => {
    globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'jsReady';
    globalThis.__TESTING_FORCE_RENDER_TO_OPCODE__ = false;
  });

  afterAll(() => {
    globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'immediately';
  });

  it('event before jsReady should works', async function() {
    // resetup
    injectTt();

    const handleTouchStart = vi.fn();

    function Comp() {
      return (
        <view>
          <text>1</text>
          <text bindtouchstart={handleTouchStart}>2</text>
        </view>
      );
    }

    function App() {
      return (
        <view>
          <Comp />
        </view>
      );
    }

    const jsxApp = <App />;

    // main thread render
    {
      __root.__jsx = jsxApp;
      renderPage({
        text: 'Hello',
      });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view>
              <text>
                <raw-text
                  text="1"
                />
              </text>
              <text
                event={
                  {
                    "bindEvent:touchstart": "-3:0:",
                  }
                }
              >
                <raw-text
                  text="2"
                />
              </text>
            </view>
          </view>
        </page>
      `);
    }

    // main thread update 1
    {
      updatePage({
        text: 'Hello 1',
      });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view>
              <text>
                <raw-text
                  text="1"
                />
              </text>
              <text
                event={
                  {
                    "bindEvent:touchstart": "-6:0:",
                  }
                }
              >
                <raw-text
                  text="2"
                />
              </text>
            </view>
          </view>
        </page>
      `);
    }

    // main thread update 2
    {
      updatePage({
        text: 'Hello 2',
      });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view>
              <text>
                <raw-text
                  text="1"
                />
              </text>
              <text
                event={
                  {
                    "bindEvent:touchstart": "-9:0:",
                  }
                }
              >
                <raw-text
                  text="2"
                />
              </text>
            </view>
          </view>
        </page>
      `);
    }

    lynxCoreInject.tt.publishEvent('-3:0:', 'event 1');
    lynxCoreInject.tt.publishEvent('-6:0:', 'event 2');
    lynxCoreInject.tt.publishEvent('-9:0:', 'event 3');

    // background render
    {
      globalEnvManager.switchToBackground();
      root.render(jsxApp, __root);

      expect(lynx.getNativeApp().callLepusMethod).toHaveBeenCalledTimes(1);
      expect(lynx.getNativeApp().callLepusMethod.mock.calls[0]).toMatchInlineSnapshot(`
          [
            "rLynxJSReady",
            {},
          ]
        `);
      globalEnvManager.switchToMainThread();
      const rLynxJSReady = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxJSReady[0]](rLynxJSReady[1]);
      lynx.getNativeApp().callLepusMethod.mockClear();
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      globalEnvManager.switchToBackground();
      const rLynxFirstScreen = globalThis.__OnLifecycleEvent.mock.calls[0];
      lynxCoreInject.tt.OnLifecycleEvent(...rLynxFirstScreen);
      expect(rLynxFirstScreen).toMatchInlineSnapshot(`
        [
          [
            "rLynxFirstScreen",
            {
              "jsReadyEventIdSwap": {
                "-1": -4,
                "-2": -5,
                "-3": -6,
                "-4": -7,
                "-5": -8,
                "-6": -9,
              },
              "refPatch": "{}",
              "root": "{"id":-7,"type":"root","children":[{"id":-8,"type":"__Card__:__snapshot_a94a8_test_12","children":[{"id":-9,"type":"__Card__:__snapshot_a94a8_test_11","values":["-9:0:"]}]}]}",
            },
          ],
        ]
      `);

      expect(handleTouchStart).toHaveBeenCalledTimes(3);
      expect(handleTouchStart.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "event 1",
          ],
          [
            "event 2",
          ],
          [
            "event 3",
          ],
        ]
      `);
    }
  });
});

describe('call `root.render()` async', () => {
  beforeAll(() => {
    // globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'jsReady';
    globalThis.__TESTING_FORCE_RENDER_TO_OPCODE__ = false;
  });

  afterAll(() => {
    // globalThis.__FIRST_SCREEN_SYNC_TIMING__ = 'immediately';
  });

  it('event should work', async function() {
    // resetup
    injectTt();

    const handleTouchStart = vi.fn();

    function Comp() {
      return (
        <view>
          <text>1</text>
          <text bindtouchstart={handleTouchStart}>2</text>
        </view>
      );
    }

    function App() {
      return (
        <view>
          <Comp />
        </view>
      );
    }

    const jsxApp = <App />;

    // main thread render
    {
      __root.__jsx = jsxApp;
      renderPage({
        text: 'Hello',
      });
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <view>
              <text>
                <raw-text
                  text="1"
                />
              </text>
              <text
                event={
                  {
                    "bindEvent:touchstart": "-3:0:",
                  }
                }
              >
                <raw-text
                  text="2"
                />
              </text>
            </view>
          </view>
        </page>
      `);

      __root[CHILDREN] = null;
    }

    lynxCoreInject.tt.publishEvent('-3:0:', 'event 1');

    // hydrate
    {
      // LifecycleConstant.firstScreen
      globalEnvManager.switchToBackground();
      const rLynxFirstScreen = globalThis.__OnLifecycleEvent.mock.calls[0];
      lynxCoreInject.tt.OnLifecycleEvent(...rLynxFirstScreen);

      expect(delayedLifecycleEvents).toMatchInlineSnapshot(`
        [
          [
            "rLynxFirstScreen",
            {
              "jsReadyEventIdSwap": {},
              "refPatch": "{}",
              "root": "{"id":-1,"type":"root","children":[{"id":-2,"type":"__Card__:__snapshot_a94a8_test_14","children":[{"id":-3,"type":"__Card__:__snapshot_a94a8_test_13","values":["-3:0:"]}]}]}",
            },
          ],
        ]
      `);
    }

    // background render
    {
      globalEnvManager.switchToBackground();
      root.render(jsxApp, __root);

      expect(delayedLifecycleEvents).toMatchInlineSnapshot(`[]`);
    }

    {
      // expect(handleTouchStart).toHaveBeenCalledTimes(3);
      expect(handleTouchStart.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "event 1",
          ],
        ]
      `);
    }
  });
});
