/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { render } from 'preact';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { replaceCommitHook } from '../../../src/snapshot/lifecycle/patch/commit';
import { injectUpdateMainThread } from '../../../src/snapshot/lifecycle/patch/updateMainThread';
import { __root } from '../../../src/root';
import { setupPage } from '../../../src/snapshot';
import { destroyWorklet } from '../../../src/snapshot/worklet/destroy';
import { workletCapture } from '../../../src/snapshot/worklet/capture';
import { clearConfigCacheForTesting } from '../../../src/snapshot/worklet/functionality';
import {
  MainThreadRef,
  isMainThreadRef,
  isMainThreadRefCallback,
  useMainThreadRef,
} from '../../../src/core/main-thread-ref';
import { takeMainThreadRefInitValuePatch } from '../../../src/core/main-thread-ref-init-value';
import { MainThreadValue } from '../../../src/snapshot/worklet/ref/mainThreadValue';
import { globalEnvManager } from '../utils/envManager';
import { injectUpdateMTRefInitValue } from '../../../src/snapshot/worklet/ref/updateInitValue';

const Comp = () => {
  const ref = useMainThreadRef(233);
  return <view></view>;
};

beforeAll(() => {
  setupPage(__CreatePage('0', 0));
  injectUpdateMainThread();
  injectUpdateMTRefInitValue();
  replaceCommitHook();
  globalThis.lynxWorkletImpl = {
    _refImpl: {
      updateWorkletRef: vi.fn(),
      updateWorkletRefInitValueChanges: vi.fn(),
      registerMainThreadValueType: vi.fn(),
      clearFirstScreenWorkletRefMap: vi.fn(),
    },
    _runOnBackgroundDelayImpl: {
      runDelayedBackgroundFunctions: vi.fn(),
    },
    _eventDelayImpl: {
      clearDelayedWorklets: vi.fn(),
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

  it('should discard pending init values when resetting the test environment', () => {
    globalEnvManager.switchToBackground();
    new MainThreadRef('stale');

    globalEnvManager.resetEnv();
    globalEnvManager.switchToBackground();
    new MainThreadRef('fresh');

    expect(takeMainThreadRefInitValuePatch()).toEqual([[1, 'fresh']]);
  });

  it('should identify main-thread ref values', () => {
    expect(isMainThreadRef({ _wvid: 1 })).toBe(true);
    expect(isMainThreadRef({ _wkltId: 'callback' })).toBe(false);
    expect(isMainThreadRefCallback({ _wkltId: 'callback' })).toBe(true);
    expect(isMainThreadRefCallback({ _wvid: 1 })).toBe(false);
  });

  it('should send init value to the main thread', () => {
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
            "rLynxChangeRefInitValue",
            {
              "data": "[[1,233]]",
            },
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

  it('should send init value to the main thread even after reloadTemplate', () => {
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

    // main thread reload
    {
      globalEnvManager.switchToMainThread();
      updatePage({}, { reloadTemplate: true });
    }

    // hydrate
    {
      // LifecycleConstant.firstScreen
      globalEnvManager.switchToBackground();
      lynxCoreInject.tt.OnLifecycleEvent(...globalThis.__OnLifecycleEvent.mock.calls[0]);

      // rLynxChange
      globalEnvManager.switchToMainThread();
      const rLynxChange = lynx.getNativeApp().callLepusMethod.mock.calls;
      expect(rLynxChange).toMatchInlineSnapshot(`
        [
          [
            "rLynxChangeRefInitValue",
            {
              "data": "[[1,233]]",
            },
          ],
          [
            "rLynxChange",
            {
              "data": "{"patchList":[{"snapshotPatch":[],"id":6}]}",
              "patchOptions": {
                "isHydration": true,
                "pipelineOptions": {
                  "dsl": "reactLynx",
                  "needTimestamps": true,
                  "pipelineID": "pipelineID",
                  "pipelineOrigin": "reactLynxHydrate",
                  "stage": "hydrate",
                },
                "reloadVersion": 1,
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
});

class TestMainThreadValue extends MainThreadValue {
  constructor(value) {
    super(value, '@test/main-thread-value');
  }
}

describe('MainThreadValue', () => {
  it('serializes an opaque typed handle and releases it with the shared id lifecycle', () => {
    globalEnvManager.switchToBackground();
    const dispatchEvent = vi.fn();
    lynx.getCoreContext = () => ({ dispatchEvent });
    const value = new TestMainThreadValue(42);

    expect(JSON.stringify(value)).toBe(
      '{"_wvid":1,"_initValue":42,"_type":"@test/main-thread-value"}',
    );

    lynx.getNativeApp().createJSObjectDestructionObserver.mock.calls[0][0]();
    expect(dispatchEvent).toHaveBeenCalledWith({
      type: 'Lynx.Worklet.releaseWorkletRef',
      data: { id: 1 },
    });
  });

  it('preserves opaque handles without changing ordinary member captures', () => {
    globalEnvManager.switchToBackground();
    const value = new TestMainThreadValue(42);
    const fallback = { get: undefined };

    expect(workletCapture(value, fallback)).toBe(value);
    expect(workletCapture({ value: 42 }, fallback)).toBe(fallback);
  });

  it('registers the main-thread factory only in the main-thread runtime', () => {
    const factory = value => ({ value });
    const register = globalThis.lynxWorkletImpl._refImpl.registerMainThreadValueType;

    globalEnvManager.switchToBackground();
    MainThreadValue.register('@test/main-thread-value', factory);
    expect(register).not.toHaveBeenCalled();

    globalEnvManager.switchToMainThread();
    MainThreadValue.register('@test/main-thread-value', factory);
    expect(register).toHaveBeenCalledWith('@test/main-thread-value', factory);

    globalThis.globDynamicComponentEntry = 'lazy-entry';
    MainThreadValue.register('@test/lazy-main-thread-value', factory);
    expect(register).toHaveBeenCalledWith('@test/lazy-main-thread-value', factory);
    delete globalThis.globDynamicComponentEntry;
  });
});
