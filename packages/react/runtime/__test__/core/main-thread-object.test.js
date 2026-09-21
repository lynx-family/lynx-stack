import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defineMainThreadObjectType } from '../../src/core/main-thread-object.js';

beforeEach(() => {
  vi.stubGlobal('__DEV__', true);
  vi.stubGlobal('__JS__', true);
  vi.stubGlobal('__LEPUS__', false);
  vi.stubGlobal('lynxWorkletImpl', {
    _refImpl: { registerMainThreadObjectType: vi.fn() },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('core/main-thread-object definition', () => {
  it('registers a type during main-thread module evaluation without rendering its hook', () => {
    const create = value => ({ value });
    const register = globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType;

    vi.stubGlobal('__JS__', false);
    vi.stubGlobal('__LEPUS__', true);
    const type = defineMainThreadObjectType({
      type: '@test/lazy-module-value',
      create,
    });

    expect(register).toHaveBeenCalledWith(
      '@test/lazy-module-value',
      create,
    );
    expect(type).not.toHaveProperty('create');
  });

  it.each([true, false])('validates and freezes object type definitions (__JS__=%s)', (isJS) => {
    vi.stubGlobal('__JS__', isJS);
    vi.stubGlobal('__LEPUS__', !isJS);
    expect(() =>
      defineMainThreadObjectType({
        type: '',
        create: value => ({ value }),
      })
    ).toThrow('MainThreadObject type must be a non-empty string.');
    expect(() =>
      defineMainThreadObjectType({
        type: 'main-thread',
        create: value => ({ value }),
      })
    ).toThrow(
      'MainThreadObject type "main-thread" is reserved for MainThreadRef.',
    );
    expect(() =>
      defineMainThreadObjectType({
        type: '@test/missing-create',
      })
    ).toThrow(
      'MainThreadObject type "@test/missing-create" must provide a create Main Thread Function.',
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
        type: '@test/js-function-capture',
        create: {
          _wkltId: 'js-function-capture',
          _jsFn: { callback: { _jsFnId: 1 } },
        },
      })
    ).toThrow(
      'MainThreadObject create function for "@test/js-function-capture" must not capture values. Import dependencies from a shared-runtime module instead.',
    );
    expect(() =>
      defineMainThreadObjectType({
        type: '@test/this-capture',
        create: {
          _wkltId: 'this-capture',
          helper: { stop() {} },
        },
      })
    ).toThrow(
      'MainThreadObject create function for "@test/this-capture" must not capture values. Import dependencies from a shared-runtime module instead.',
    );
    const hiddenCapture = { _wkltId: 'hidden-capture' };
    Object.defineProperty(hiddenCapture, 'helper', { value: 1 });
    expect(() =>
      defineMainThreadObjectType({
        type: '@test/hidden-capture',
        create: hiddenCapture,
      })
    ).toThrow(
      'MainThreadObject create function for "@test/hidden-capture" must not capture values. Import dependencies from a shared-runtime module instead.',
    );
    const symbolCapture = {
      _wkltId: 'symbol-capture',
      [Symbol('helper')]: 1,
    };
    expect(() =>
      defineMainThreadObjectType({
        type: '@test/symbol-capture',
        create: symbolCapture,
      })
    ).toThrow(
      'MainThreadObject create function for "@test/symbol-capture" must not capture values. Import dependencies from a shared-runtime module instead.',
    );
    const accessorClosure = {
      _wkltId: 'accessor-closure',
      get _c() {
        return {};
      },
    };
    expect(() =>
      defineMainThreadObjectType({
        type: '@test/accessor-closure',
        create: accessorClosure,
      })
    ).toThrow(
      'MainThreadObject create function for "@test/accessor-closure" must not capture values. Import dependencies from a shared-runtime module instead.',
    );
    const type = defineMainThreadObjectType({
      type: '@test/frozen',
      create: value => ({ value }),
    });
    expect(Object.isFrozen(type)).toBe(true);

    vi.stubGlobal('__DEV__', false);
    const ownKeys = vi.fn(Reflect.ownKeys);
    const create = new Proxy({
      _wkltId: 'production-create',
      _c: { mutableValue: 1 },
    }, { ownKeys });
    const productionType = defineMainThreadObjectType({
      type: '@test/production',
      create,
    });
    expect(productionType.type).toBe('@test/production');
    expect(ownKeys).not.toHaveBeenCalled();
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
    vi.stubGlobal('__JS__', false);
    vi.stubGlobal('__LEPUS__', true);

    try {
      expect(() => defineMainThreadObjectType(definition)).toThrow(
        'MainThreadObject requires a newer ReactLynx main-thread runtime. Upgrade the main template runtime or rebuild the lazy bundle with a compatible @lynx-js/react version.',
      );
    } finally {
      refImpl.registerMainThreadObjectType = register;
    }
  });
});
