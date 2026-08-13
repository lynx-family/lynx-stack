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
import { captureMainThreadObject } from '../../../src/snapshot/worklet/capture';
import { clearConfigCacheForTesting } from '../../../src/snapshot/worklet/functionality';
import {
  MainThreadRef,
  isMainThreadRef,
  isMainThreadRefCallback,
  useMainThreadRef,
} from '../../../src/core/main-thread-ref';
import { takeMainThreadRefInitValuePatch } from '../../../src/core/main-thread-ref-init-value';
import {
  defineMainThreadObjectType,
  registerMainThreadObjectDefinition,
  useMainThreadObject,
} from '../../../src/snapshot/worklet/ref/mainThreadObject';
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
      registerMainThreadObjectType: vi.fn(),
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

function renderTestMainThreadObject(initialValue) {
  const type = defineMainThreadObjectType({
    type: '@test/main-thread-object',
    create: value => ({ value }),
  });
  let value;
  const App = () => {
    value = useMainThreadObject(type, initialValue);
    return <view />;
  };
  render(<App />, __root);
  return value;
}

describe('MainThreadObject', () => {
  it('serializes an opaque typed handle and releases it with the shared id lifecycle', () => {
    globalEnvManager.switchToBackground();
    const dispatchEvent = vi.fn();
    lynx.getCoreContext = () => ({ dispatchEvent });
    const value = renderTestMainThreadObject(42);

    expect(JSON.parse(JSON.stringify(value))).toEqual({
      _wvid: 1,
      _initValue: 42,
      _type: '@test/main-thread-object',
      _mtoVersion: 1,
    });

    lynx.getNativeApp().createJSObjectDestructionObserver.mock.calls[0][0]();
    expect(dispatchEvent).toHaveBeenCalledWith({
      type: 'Lynx.Worklet.releaseWorkletRef',
      data: { id: 1 },
    });
  });

  it('preserves opaque handles without changing ordinary member captures', () => {
    globalEnvManager.switchToBackground();
    const value = renderTestMainThreadObject(42);

    expect(captureMainThreadObject(value)).toBe(value);
    expect(captureMainThreadObject({ value: 42 })).toBeUndefined();
  });

  it('creates a typed handle through the library-author hook', () => {
    const definition = {
      type: '@test/counter',
      create: value => ({ value }),
    };
    const type = defineMainThreadObjectType(definition);
    let counter;
    const App = () => {
      counter = useMainThreadObject(type, 42);
      return <view />;
    };

    globalThis.globDynamicComponentEntry = '__Card__';
    globalEnvManager.switchToBackground();
    render(<App />, __root);

    expect(JSON.parse(JSON.stringify(counter))).toMatchObject({
      _initValue: 42,
      _type: '@test/counter',
      _mtoVersion: 1,
    });
    definition.type = '@test/mutated-counter';
    expect(type.type).toBe('@test/counter');
    expect(type).not.toHaveProperty('create');
    expect(type).not.toHaveProperty('dispose');
    expect(type.isHandle(counter)).toBe(true);
    expect(type.getInitialPayload(counter)).toBe(42);

    const otherType = defineMainThreadObjectType({
      type: '@test/other-counter',
      create: value => ({ value }),
    });
    expect(otherType.isHandle(counter)).toBe(false);
    expect(otherType.isHandle(null)).toBe(false);
    expect(otherType.isHandle(42)).toBe(false);
    expect(() => otherType.getInitialPayload(counter)).toThrow(
      'Value is not a MainThreadObject handle for type "@test/other-counter".',
    );
    expect(() => counter.get()).toThrow(
      'MainThreadObject handle for "@test/counter" cannot access "get" in the background runtime. Use the object only inside a main-thread function.',
    );
    expect(() => counter.value = 43).toThrow(
      'MainThreadObject handle for "@test/counter" cannot set "value" in the background runtime. Use the object only inside a main-thread function.',
    );
    expect(() => counter._type = '@test/counter').not.toThrow();
  });

  it('registers a type during main-thread module evaluation without rendering its hook', () => {
    const create = value => ({ value });
    const register = globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType;

    globalEnvManager.switchToMainThread();
    const type = defineMainThreadObjectType({
      type: '@test/lazy-module-value',
      create,
    });

    expect(register).toHaveBeenCalledWith(
      '@test/lazy-module-value',
      create,
      undefined,
      1,
    );
    expect(type).not.toHaveProperty('create');
  });

  it('ensures registration on the first main-thread hook use', () => {
    const create = value => ({ value });
    const register = globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType;

    globalEnvManager.switchToBackground();
    const type = defineMainThreadObjectType({
      type: '@test/retained-module-value',
      create,
    });
    expect(register).not.toHaveBeenCalled();

    globalEnvManager.switchToMainThread();
    const App = () => {
      useMainThreadObject(type, 42);
      return <view />;
    };
    render(<App />, __root);

    expect(register).toHaveBeenCalledWith(
      '@test/retained-module-value',
      create,
      undefined,
      1,
    );
  });

  it('rejects a forged main-thread object type token', () => {
    globalEnvManager.switchToMainThread();
    const App = () => {
      useMainThreadObject({ type: '@test/forged' }, 42);
      return <view />;
    };

    expect(() => render(<App />, __root)).toThrow(
      'Invalid MainThreadObject type token for "@test/forged". Create it with defineMainThreadObjectType().',
    );
  });

  it('uses a plain serializable handle in the main-thread runtime', () => {
    globalEnvManager.switchToMainThread();
    const type = defineMainThreadObjectType({
      type: '@test/main-thread-counter',
      create: value => ({ value }),
    });
    let counter;
    const App = () => {
      counter = useMainThreadObject(type, 42);
      return <view />;
    };

    globalThis.globDynamicComponentEntry = '__Card__';
    render(<App />, __root);

    expect(JSON.parse(JSON.stringify(counter))).toMatchObject({
      _initValue: 42,
      _type: '@test/main-thread-counter',
      _mtoVersion: 1,
    });
  });

  it('validates and freezes object type definitions', () => {
    expect(() =>
      defineMainThreadObjectType({
        type: '',
        create: value => ({ value }),
      })
    ).toThrow('MainThreadObject type must be a non-empty string.');
    expect(() =>
      defineMainThreadObjectType({
        type: '@test/missing-create',
      })
    ).toThrow(
      'MainThreadObject type "@test/missing-create" must provide a create Main Thread Function.',
    );
    expect(() =>
      defineMainThreadObjectType({
        type: '@test/invalid-dispose',
        create: value => ({ value }),
        dispose: true,
      })
    ).toThrow(
      'MainThreadObject type "@test/invalid-dispose" has an invalid dispose Main Thread Function.',
    );

    expect(() =>
      defineMainThreadObjectType({
        type: '@test/capturing-create',
        create: {
          _wkltId: 'capturing-create',
          _c: { mutableValue: 1 },
        },
      })
    ).toThrow(
      'MainThreadObject create function for "@test/capturing-create" must not capture values. Import dependencies from a shared-runtime module instead.',
    );
    expect(() =>
      defineMainThreadObjectType({
        type: '@test/capturing-dispose',
        create: value => ({ value }),
        dispose: {
          _wkltId: 'capturing-dispose',
          _c: { mutableValue: 1 },
        },
      })
    ).toThrow(
      'MainThreadObject dispose function for "@test/capturing-dispose" must not capture values. Import dependencies from a shared-runtime module instead.',
    );

    const type = defineMainThreadObjectType({
      type: '@test/frozen',
      create: value => ({ value }),
    });
    expect(Object.isFrozen(type)).toBe(true);
  });

  it('rejects non-serializable initialization payloads in development', () => {
    globalEnvManager.switchToBackground();

    expect(() => renderTestMainThreadObject({ nested: { callback() {} } }))
      .toThrow(
        'MainThreadObject initial value for "@test/main-thread-object" must be JSON-serializable; invalid value at $.nested.callback.',
      );

    const cyclic = {};
    cyclic.self = cyclic;
    expect(() => renderTestMainThreadObject(cyclic)).toThrow(
      'MainThreadObject initial value for "@test/main-thread-object" must be JSON-serializable; invalid value at $.self.',
    );
    expect(() => renderTestMainThreadObject(new Date())).toThrow(
      'MainThreadObject initial value for "@test/main-thread-object" must be JSON-serializable; invalid value at $.',
    );
    expect(() => renderTestMainThreadObject([1, { value: 2 }])).not.toThrow();
  });

  it('diagnoses an incompatible main-thread runtime', () => {
    const definition = {
      type: '@test/incompatible-runtime',
      create: value => ({ value }),
    };
    defineMainThreadObjectType(definition);
    const refImpl = globalThis.lynxWorkletImpl._refImpl;
    const register = refImpl.registerMainThreadObjectType;
    delete refImpl.registerMainThreadObjectType;
    globalEnvManager.switchToMainThread();

    expect(() => registerMainThreadObjectDefinition(definition)).toThrow(
      'MainThreadObject requires a newer ReactLynx main-thread runtime. Upgrade the main template runtime or rebuild the lazy bundle with a compatible @lynx-js/react version.',
    );

    refImpl.registerMainThreadObjectType = register;
  });
});
