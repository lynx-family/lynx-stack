/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { replaceCommitHook } from '../../src/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../src/lifecycle/patch/updateMainThread';
import { __root } from '../../src/root';
import { setupPage } from '../../src/snapshot';
import { destroyWorklet } from '../../src/worklet/destroy';
import { clearConfigCacheForTesting } from '../../src/worklet/functionality';
import { MainThreadRef, useMainThreadRef } from '../../src/worklet/workletRef';
import { globalEnvManager } from '../utils/envManager';

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
  replaceCommitHook();
  globalThis.lynxWorkletImpl = {
    _refImpl: {
      updateWorkletRef: vi.fn(),
      updateWorkletRefInitValueChanges: vi.fn(),
      clearFirstScreenWorkletRefMap: vi.fn(),
    },
    _runOnBackgroundDelayImpl: {
      runDelayedBackgroundFunctions: vi.fn(),
    },
  };
});

beforeEach(() => {
  globalEnvManager.resetEnv();
  SystemInfo.lynxSdkVersion = '999.999';
  clearConfigCacheForTesting();
});

afterEach(() => {
  destroyWorklet();
  vi.clearAllMocks();
});

describe('WorkletRef in js', () => {
  it('should destroy when main thread agrees', () => {
    globalEnvManager.switchToBackground();
    const ref = new MainThreadRef(1);
    lynx.getNativeApp().createJSObjectDestructionObserver.mock.calls[0][0]();
    expect(lynx.getCoreContext().dispatchEvent.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "data": {
              "id": 1,
            },
            "type": "Lynx.Worklet.releaseWorkletRef",
          },
        ],
      ]
    `);
  });

  it('to json', () => {
    globalEnvManager.switchToBackground();
    const ref = new MainThreadRef(1);
    expect(JSON.stringify(ref)).toMatchInlineSnapshot(`"{"_wvid":1}"`);
  });

  it('should send init value to the main thread', () => {
    const Comp = () => {
      const ref = useMainThreadRef(233);
      return <view></view>;
    };

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
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
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls;
      expect(rLynxChange).toMatchInlineSnapshot(`
        [
          [
            "rLynxChange",
            {
              "data": "{"patchList":[{"id":1,"workletRefInitValuePatch":[[1,233]]}]}",
              "patchOptions": {
                "reloadVersion": 0,
              },
            },
            [Function],
          ],
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
      globalThis[rLynxChange[0][0]](rLynxChange[0][1]);
      expect(globalThis.lynxWorkletImpl._refImpl.updateWorkletRefInitValueChanges).toBeCalledTimes(1);
      globalThis[rLynxChange[1][0]](rLynxChange[1][1]);
      expect(globalThis.lynxWorkletImpl._refImpl.updateWorkletRefInitValueChanges).toBeCalledTimes(1);
    }
  });

  it('should throw when getting and setting in background', () => {
    globalEnvManager.switchToBackground();
    const ref = new MainThreadRef(1);
    expect(() => ref.current).toThrowError(
      'MainThreadRef: value of a MainThreadRef cannot be accessed in the background thread.',
    );
    expect(() => ref.current = 1).toThrowError(
      'MainThreadRef: value of a MainThreadRef cannot be accessed in the background thread.',
    );
  });

  it('should throw when getting and setting outside of main thread script', () => {
    globalEnvManager.switchToMainThread();
    const ref = new MainThreadRef(1);
    expect(() => ref.current).toThrowError(
      'MainThreadRef: value of a MainThreadRef cannot be accessed outside of main thread script.',
    );
    expect(() => ref.current = 1).toThrowError(
      'MainThreadRef: value of a MainThreadRef cannot be accessed outside of main thread script.',
    );
  });

  it('should throw when native capabilities not fulfilled', () => {
    globalEnvManager.switchToBackground();
    lynx.getCoreContext = undefined;
    expect(() => {
      new MainThreadRef(1);
    }).not.toThrow();
  });

  it('should not send init value to the main thread when native capabilities not fulfilled', () => {
    SystemInfo.lynxSdkVersion = '2.13';
    const Comp = () => {
      const ref = useMainThreadRef(233);
      return <view></view>;
    };

    // main thread render
    {
      __root.__jsx = <Comp />;
      renderPage();
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
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls;
      expect(rLynxChange).toMatchInlineSnapshot(`
        [
          [
            "rLynxChange",
            {
              "data": "{"patchList":[{"snapshotPatch":[],"id":4}]}",
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
  });
});
