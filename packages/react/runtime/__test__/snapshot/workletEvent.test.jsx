/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Component, useState } from '../../src/index';
import { replaceCommitHook } from '../../src/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../src/lifecycle/patch/updateMainThread';
import { renderBackground as render } from '../../src/lifecycle/render';
import { __root } from '../../src/root';
import { setupPage } from '../../src/snapshot';
import { globalEnvManager } from '../utils/envManager';
import { elementTree, waitSchedule } from '../utils/nativeMethod';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
  replaceCommitHook();
});

beforeEach(() => {
  globalEnvManager.resetEnv();
  SystemInfo.lynxSdkVersion = '999.999';
});

afterEach(() => {
  vi.restoreAllMocks();
  elementTree.clear();
});

describe('WorkletEvent', () => {
  it('insert', async function() {
    let setHandleTap1_;
    function Comp() {
      const [handleTap1, setHandleTap1] = useState(undefined);
      setHandleTap1_ = setHandleTap1;
      return (
        <view>
          <text
            main-thread:bindtap={handleTap1}
          >
            1
          </text>
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
    }

    // update
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      setHandleTap1_({
        _wkltId: '835d:450ef:1',
      });
      await waitSchedule();

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text
              event={
                {
                  "bindEvent:tap": {
                    "type": "worklet",
                    "value": {
                      "_execId": 1,
                      "_wkltId": "835d:450ef:1",
                      "_workletType": "main-thread",
                    },
                  },
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
  });

  it('update', async function() {
    let setHandleTap1_;
    function Comp() {
      const [handleTap1, setHandleTap1] = useState({
        _wkltId: '835d:450ef:1',
      });
      setHandleTap1_ = setHandleTap1;
      return (
        <view>
          <text
            main-thread:bindtap={handleTap1}
          >
            1
          </text>
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
                  "bindEvent:tap": {
                    "type": "worklet",
                    "value": {
                      "_wkltId": "835d:450ef:1",
                      "_workletType": "main-thread",
                    },
                  },
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

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    // update
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      setHandleTap1_({
        _wkltId: '835d:450ef:2',
      });
      await waitSchedule();

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text
              event={
                {
                  "bindEvent:tap": {
                    "type": "worklet",
                    "value": {
                      "_execId": 3,
                      "_wkltId": "835d:450ef:2",
                      "_workletType": "main-thread",
                    },
                  },
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
  });

  it('remove', async function() {
    let setHandleTap1_;
    function Comp() {
      const [handleTap1, setHandleTap1] = useState({
        _wkltId: '835d:450ef:1',
      });
      setHandleTap1_ = setHandleTap1;
      return (
        <view>
          <text
            main-thread:bindtap={handleTap1}
          >
            1
          </text>
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
                  "bindEvent:tap": {
                    "type": "worklet",
                    "value": {
                      "_wkltId": "835d:450ef:1",
                      "_workletType": "main-thread",
                    },
                  },
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

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    // update
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      setHandleTap1_(undefined);
      await waitSchedule();

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text
              event={
                {
                  "bindEvent:tap": {
                    "type": "worklet",
                    "value": {
                      "_workletType": "main-thread",
                    },
                  },
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
  });

  it('insert element', async function() {
    function Comp(props) {
      return (
        <view>
          {props.show && (
            <text
              main-thread:bindtap={{
                _wkltId: '835d:450ef:1',
              }}
            >
              1
            </text>
          )}
        </view>
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp show={false} />;
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
      render(<Comp show={false} />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    // update
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      render(<Comp show={true} />, __root);
      await waitSchedule();

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text
              event={
                {
                  "bindEvent:tap": {
                    "type": "worklet",
                    "value": {
                      "_execId": 5,
                      "_wkltId": "835d:450ef:1",
                      "_workletType": "main-thread",
                    },
                  },
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
  });
});

describe('WorkletEvent in spread', () => {
  it('insert', async function() {
    let setSpread_;
    function Comp() {
      const [spread, setSpread] = useState({});
      setSpread_ = setSpread;
      return (
        <view>
          <text
            {...spread}
          >
            1
          </text>
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
    }

    // update
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      setSpread_({
        'main-thread:bindtap': {
          _wkltId: '835d:450ef:1',
        },
      });
      await waitSchedule();

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text
              event={
                {
                  "bindEvent:tap": {
                    "type": "worklet",
                    "value": {
                      "_execId": 6,
                      "_wkltId": "835d:450ef:1",
                      "_workletType": "main-thread",
                    },
                  },
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
  });

  it('update', async function() {
    let setSpread_;
    function Comp() {
      const [spread, setSpread] = useState({
        'main-thread:bindtap': {
          _wkltId: '835d:450ef:0',
        },
      });
      setSpread_ = setSpread;
      return (
        <view>
          <text
            {...spread}
          >
            1
          </text>
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
                  "bindEvent:tap": {
                    "type": "worklet",
                    "value": {
                      "_wkltId": "835d:450ef:0",
                      "_workletType": "main-thread",
                    },
                  },
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

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    // update
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      setSpread_({
        'main-thread:bindtap': {
          _wkltId: '835d:450ef:1',
        },
      });
      await waitSchedule();

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text
              event={
                {
                  "bindEvent:tap": {
                    "type": "worklet",
                    "value": {
                      "_execId": 8,
                      "_wkltId": "835d:450ef:1",
                      "_workletType": "main-thread",
                    },
                  },
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
  });

  it('remove', async function() {
    let setSpread_;
    function Comp() {
      const [spread, setSpread] = useState({
        'main-thread:bindtap': {
          _wkltId: '835d:450ef:0',
        },
      });
      setSpread_ = setSpread;
      return (
        <view>
          <text
            {...spread}
          >
            1
          </text>
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
                  "bindEvent:tap": {
                    "type": "worklet",
                    "value": {
                      "_wkltId": "835d:450ef:0",
                      "_workletType": "main-thread",
                    },
                  },
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

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    // update
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      setSpread_({});
      await waitSchedule();

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text
              event={
                {
                  "bindEvent:tap": {
                    "type": "worklet",
                    "value": {
                      "_workletType": "main-thread",
                    },
                  },
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
  });

  it('insert element', async function() {
    function Comp(props) {
      const spread = {
        'main-thread:bindtap': {
          _wkltId: '835d:450ef:1',
        },
      };
      return (
        <view>
          {props.show && (
            <text
              {...spread}
            >
              1
            </text>
          )}
        </view>
      );
    }

    // main thread render
    {
      __root.__jsx = <Comp show={false} />;
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
      render(<Comp show={false} />, __root);
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
    }

    // update
    {
      globalEnvManager.switchToBackground();
      lynx.getNativeApp().callLepusMethod.mockClear();
      render(<Comp show={true} />, __root);
      await waitSchedule();

      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls[0];
      globalThis[rLynxChange[0]](rLynxChange[1]);
      expect(__root.__element_root).toMatchInlineSnapshot(`
        <page
          cssId="default-entry-from-native:0"
        >
          <view>
            <text
              event={
                {
                  "bindEvent:tap": {
                    "type": "worklet",
                    "value": {
                      "_execId": 10,
                      "_wkltId": "835d:450ef:1",
                      "_workletType": "main-thread",
                    },
                  },
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
  });
});
