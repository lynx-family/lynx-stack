// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getFromWorkletRefMap,
  isHydratedWorkletValue,
  removeValueFromWorkletRefMap,
  updateWorkletRefInitValueChanges,
} from '../../src/worklet-runtime/workletRef';
import { initWorklet } from '../../src/worklet-runtime/workletRuntime';

const originalDev = globalThis.__DEV__;

beforeEach(() => {
  globalThis.__DEV__ = false;
  globalThis.SystemInfo = {
    lynxSdkVersion: '2.16',
  };
  initWorklet();
});

afterEach(() => {
  globalThis.__DEV__ = originalDev;
  delete globalThis.lynxWorkletImpl;
});

describe('MainThreadObject registry and realization', () => {
  it('creates registered main-thread objects from typed patches', () => {
    const value = { get: () => 42 };
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/value',
      () => value,
    );

    updateWorkletRefInitValueChanges([[7, 42, '@test/value']]);

    expect(getFromWorkletRefMap({ _wvid: 7 })).toBe(value);
    removeValueFromWorkletRefMap(7);
  });

  it('lazily resolves and caches Main Thread Function factory descriptors', () => {
    const create = vi.fn(value => ({ value }));
    const createDescriptor = { _wkltId: 'create-test-value' };
    const bindFactory = vi.spyOn(create, 'bind');

    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/lazy-factory',
      createDescriptor,
    );

    // Type definition evaluation happens before the compiler-appended
    // registerWorklet calls at the end of the MTS module.
    globalThis.registerWorklet('main-thread', 'create-test-value', create);
    const lookupFactory = vi.fn(() => create);
    Object.defineProperty(lynxWorkletImpl._workletMap, 'create-test-value', { get: lookupFactory });

    updateWorkletRefInitValueChanges([
      [71, 'first', '@test/lazy-factory'],
      [72, 'second', '@test/lazy-factory'],
    ]);
    expect(getFromWorkletRefMap({ _wvid: 71 })).toMatchObject({ value: 'first' });
    expect(getFromWorkletRefMap({ _wvid: 72 })).toMatchObject({ value: 'second' });
    expect(create).toHaveBeenCalledTimes(2);
    expect(lookupFactory).toHaveBeenCalledOnce();
    expect(bindFactory).not.toHaveBeenCalled();

    removeValueFromWorkletRefMap(71);
    removeValueFromWorkletRefMap(72);
    expect(lookupFactory).toHaveBeenCalledOnce();
  });

  it('rejects an unregistered main-thread object type', () => {
    expect(() => {
      updateWorkletRefInitValueChanges([[8, 42, '@test/missing']]);
    }).toThrow('MainThreadObject type is not registered: "@test/missing"');
  });

  it.each([{}, { _lepusWorkletHash: 'legacy' }, { _wkltId: 'legacy', _lepusWorkletHash: 'legacy' }])(
    'rejects invalid factory descriptors %j',
    (descriptor) => {
      lynxWorkletImpl._refImpl.registerMainThreadObjectType('@test/invalid-factory', descriptor);
      expect(() => updateWorkletRefInitValueChanges([[1, null, '@test/invalid-factory']]))
        .toThrow('Cannot resolve an invalid Main Thread Function.');
    },
  );

  it('rejects conflicting registrations for the same type key', () => {
    const create = value => ({ value });
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/value',
      create,
    );
    expect(() => {
      globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
        '@test/value',
        value => ({ conflictingValue: value }),
      );
    }).toThrow('Conflicting MainThreadObject registration for type "@test/value"');
    expect(() => {
      globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
        '@test/value',
        create,
      );
    }).not.toThrow();

    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/worklet-value',
      { _wkltId: 'stable-create' },
    );
    expect(() => {
      globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
        '@test/worklet-value',
        { _wkltId: 'stable-create' },
      );
    }).not.toThrow();
    expect(() => {
      globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
        '@test/worklet-value',
        { _wkltId: 'different-create' },
      );
    }).toThrow('Conflicting MainThreadObject registration for type "@test/worklet-value"');
  });

  it('reserves the legacy MainThreadRef type key for typed registrations', () => {
    expect(() => {
      globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
        'main-thread',
        value => ({ value }),
      );
    }).toThrow(
      'MainThreadObject type "main-thread" is reserved for MainThreadRef.',
    );
  });

  it('allows equivalent registrations from separately evaluated modules', () => {
    const createDefinition = () => value => ({ value });
    const createA = createDefinition();
    const createB = createDefinition();

    expect(createA).not.toBe(createB);
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/lazy-duplicate',
      createA,
    );
    expect(() => {
      globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
        '@test/lazy-duplicate',
        createB,
      );
    }).not.toThrow();
  });

  it('rejects factories that do not create objects', () => {
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/invalid',
      () => 42,
    );

    expect(() => {
      updateWorkletRefInitValueChanges([[10, 42, '@test/invalid']]);
    }).toThrow('MainThreadObject type "@test/invalid" created a non-object value.');
  });

  it('recognizes realized objects before inspecting their properties', () => {
    const value = new Proxy({ value: 42 }, {
      get() {
        throw new Error('unexpected property access');
      },
    });
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/proxy-value',
      () => value,
    );

    updateWorkletRefInitValueChanges([[93, null, '@test/proxy-value']]);

    expect(isHydratedWorkletValue(getFromWorkletRefMap({ _wvid: 93 }))).toBe(true);
    removeValueFromWorkletRefMap(93);
  });
});
