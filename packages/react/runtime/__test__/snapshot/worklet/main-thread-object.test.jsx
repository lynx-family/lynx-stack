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
import { clearConfigCacheForTesting } from '../../../src/snapshot/worklet/functionality';
import { captureMainThreadObject } from '../../../src/core/capture-main-thread-object';
import { defineMainThreadObjectType, useMainThreadObject } from '../../../src/core/main-thread-object';
import { globalEnvManager } from '../utils/envManager';
import { injectUpdateMTRefInitValue } from '../../../src/snapshot/worklet/ref/updateInitValue';

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

  it('creates a typed handle through the library-author hook', async () => {
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
    const counterHandle = type.downcast(counter);
    expect(counterHandle).toBe(counter);
    expect(counterHandle.creationPayload).toBe(42);

    const otherType = defineMainThreadObjectType({
      type: '@test/other-counter',
      create: value => ({ value }),
    });
    expect(otherType.downcast(counter)).toBeUndefined();
    expect(otherType.downcast(null)).toBeUndefined();
    expect(otherType.downcast(42)).toBeUndefined();
    expect(otherType.downcast({
      _initValue: 42,
      _type: '@test/other-counter',
    })).toBeUndefined();
    expect(() => counter.get()).toThrow(
      'MainThreadObject handle for "@test/counter" cannot access "get" in the background runtime. Use the object only inside a main-thread function.',
    );
    expect(counter.then).toBeUndefined();
    expect(counter.$$typeof).toBeUndefined();
    expect(counter[Symbol.toStringTag]).toBeUndefined();
    await expect(Promise.resolve(counter)).resolves.toBe(counter);
    expect(() => counter.value = 43).toThrow(
      'MainThreadObject handle for "@test/counter" cannot set "value" in the background runtime. Use the object only inside a main-thread function.',
    );
    expect(() => counter._type = '@test/counter').not.toThrow();
  });

  it('ensures registration on the first main-thread hook use', () => {
    const create = value => ({ value });
    const register = globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType;

    globalEnvManager.switchToBackground();
    const definition = {
      type: '@test/retained-module-value',
      create,
    };
    const type = defineMainThreadObjectType(definition);
    expect(register).not.toHaveBeenCalled();

    // Registration is deferred in the background runtime. Mutating the
    // caller-owned object before the first main-thread use must not change the
    // validated definition retained by the type token.
    definition.type = '@test/mutated-retained-module-value';
    definition.create = value => ({ value: value + 1 });

    globalEnvManager.switchToMainThread();
    const App = () => {
      useMainThreadObject(type, 42);
      return <view />;
    };
    render(<App />, __root);

    expect(register).toHaveBeenCalledWith(
      '@test/retained-module-value',
      create,
      1,
    );
  });

  it('snapshots accessor-backed definition fields before validation', () => {
    let typeReads = 0;
    let createReads = 0;
    const create = value => ({ value });
    const definition = {
      get type() {
        typeReads += 1;
        return typeReads === 1 ? '@test/accessor-definition' : '@test/mutated-definition';
      },
      get create() {
        createReads += 1;
        return createReads === 1 ? create : { _wkltId: 'invalid-create' };
      },
    };

    globalEnvManager.switchToBackground();
    const type = defineMainThreadObjectType(definition);
    expect(type.type).toBe('@test/accessor-definition');
    expect(typeReads).toBe(1);
    expect(createReads).toBe(1);

    globalEnvManager.switchToMainThread();
    const App = () => {
      useMainThreadObject(type, 42);
      return <view />;
    };
    render(<App />, __root);

    expect(globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType)
      .toHaveBeenCalledWith('@test/accessor-definition', create, 1);
    expect(typeReads).toBe(1);
    expect(createReads).toBe(1);
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
    const sparseArray = Array(2);
    sparseArray[1] = 1;
    expect(() => renderTestMainThreadObject(sparseArray)).not.toThrow();
    expect(() => renderTestMainThreadObject([undefined, 1])).toThrow(
      'MainThreadObject initial value for "@test/main-thread-object" must be JSON-serializable; invalid value at $.0.',
    );

    const arrayWithCustomFlatMap = [undefined, 1];
    arrayWithCustomFlatMap.flatMap = () => [];
    expect(() => renderTestMainThreadObject(arrayWithCustomFlatMap)).toThrow(
      'MainThreadObject initial value for "@test/main-thread-object" must be JSON-serializable; invalid value at $.0.',
    );
  });

  it('exposes the readonly-typed creation payload without a runtime copy', () => {
    globalEnvManager.switchToBackground();
    const initialValue = { nested: { value: 1 }, values: [2, 3] };
    const value = renderTestMainThreadObject(initialValue);
    const handle = captureMainThreadObject(value);

    expect(handle).toBeDefined();

    initialValue.nested.value = 4;
    initialValue.values.push(5);

    expect(handle.creationPayload).toBe(initialValue);
    expect(Object.isFrozen(handle.creationPayload)).toBe(false);
    expect(handle.creationPayload).toEqual({ nested: { value: 4 }, values: [2, 3, 5] });
    expect(JSON.parse(JSON.stringify(value))._initValue).toEqual({
      nested: { value: 4 },
      values: [2, 3, 5],
    });
  });

  it('identifies registered main-thread object handles', () => {
    globalEnvManager.switchToBackground();
    const value = renderTestMainThreadObject({ value: 1 });

    expect(captureMainThreadObject(value)).toBe(value);
    expect(captureMainThreadObject({ value: 1 })).toBeUndefined();
  });
});
