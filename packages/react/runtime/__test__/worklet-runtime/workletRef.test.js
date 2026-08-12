// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getFromWorkletRefMap,
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

describe('WorkletRef', () => {
  it('creates registered main-thread objects from typed patches', () => {
    const value = { get: () => 42 };
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/value',
      () => value,
      undefined,
      1,
    );

    updateWorkletRefInitValueChanges([[7, 42, '@test/value', 1]]);

    expect(getFromWorkletRefMap({ _wvid: 7 })).toBe(value);
    removeValueFromWorkletRefMap(7);
  });

  it('rejects an unregistered main-thread object type', () => {
    expect(() => {
      updateWorkletRefInitValueChanges([[8, 42, '@test/missing', 1]]);
    }).toThrow('MainThreadObject type is not registered: "@test/missing"');
  });

  it('rejects conflicting registrations for the same type key', () => {
    const create = value => ({ value });
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/value',
      create,
      undefined,
      1,
    );
    expect(() => {
      globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
        '@test/value',
        value => ({ value }),
        undefined,
        1,
      );
    }).toThrow('Conflicting MainThreadObject registration for type "@test/value"');
    expect(() => {
      globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
        '@test/value',
        create,
        undefined,
        1,
      );
    }).not.toThrow();
  });

  it('rejects incompatible handle protocol versions', () => {
    expect(() => {
      globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
        '@test/future',
        value => ({ value }),
        undefined,
        2,
      );
    }).toThrow(
      'MainThreadObject protocol mismatch for type "@test/future": runtime supports version 1, but the handle or bundle uses 2.',
    );

    expect(() => {
      updateWorkletRefInitValueChanges([[9, 42, '@test/legacy', undefined]]);
    }).toThrow(
      'MainThreadObject protocol mismatch for type "@test/legacy": runtime supports version 1, but the handle or bundle uses undefined.',
    );
  });

  it('rejects factories that do not create objects', () => {
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/invalid',
      () => 42,
      undefined,
      1,
    );

    expect(() => {
      updateWorkletRefInitValueChanges([[10, 42, '@test/invalid', 1]]);
    }).toThrow('MainThreadObject type "@test/invalid" created a non-object value.');
  });

  it('hydrates a used first-screen main-thread object into the background id', () => {
    const dispose = vi.fn();
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/value',
      value => ({ get: () => value }),
      dispose,
      1,
    );
    const firstScreenWorklet = {
      _wkltId: 'typed-value',
      _c: {
        value: {
          _wvid: -1,
          _initValue: 42,
          _type: '@test/value',
          _mtoVersion: 1,
        },
      },
    };
    const worklet = {
      _wkltId: 'typed-value',
      _c: {
        value: {
          _wvid: 1,
          _initValue: 42,
          _type: '@test/value',
          _mtoVersion: 1,
        },
      },
    };
    globalThis.registerWorklet('main-thread', 'typed-value', function() {
      return this._c.value.get();
    });

    expect(globalThis.runWorklet(firstScreenWorklet, [])).toBe(42);
    const firstScreenValue = firstScreenWorklet._c.value;
    updateWorkletRefInitValueChanges([[1, 42, '@test/value', 1]]);
    globalThis.lynxWorkletImpl._hydrateCtx(worklet, firstScreenWorklet);

    expect(getFromWorkletRefMap({ _wvid: 1 })).toBe(firstScreenValue);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(dispose).not.toHaveBeenCalledWith(firstScreenValue);

    removeValueFromWorkletRefMap(1);
    expect(dispose).toHaveBeenCalledWith(firstScreenValue);
  });

  it('should create, get, update & remove', () => {
    updateWorkletRefInitValueChanges([[1, 'ref1'], [2, 'ref2']]);
    expect(getFromWorkletRefMap({ _wvid: 1 }).current).toBe('ref1');
    expect(getFromWorkletRefMap({ _wvid: 2 }).current).toBe('ref2');
    expect(getFromWorkletRefMap({ _wvid: 3 })).toBe(undefined);

    removeValueFromWorkletRefMap(1);
    expect(getFromWorkletRefMap({ _wvid: 1 })).toBe(undefined);
    expect(getFromWorkletRefMap({ _wvid: 2 }).current).toBe('ref2');

    globalThis.lynxWorkletImpl._refImpl.updateWorkletRef({
      _wvid: 2,
    }, 'ref2-new');
    expect(getFromWorkletRefMap({ _wvid: 2 }).current.element).toBe('ref2-new');

    globalThis.lynxWorkletImpl._refImpl.updateWorkletRef({
      _wvid: 2,
    }, null);
    expect(getFromWorkletRefMap({ _wvid: 2 }).current).toBe(null);

    globalThis.lynxWorkletImpl._refImpl._workletRefMap[99] = null;
    expect(() => removeValueFromWorkletRefMap(99)).not.toThrow();
  });

  it('should create, get and update at first screen', () => {
    getFromWorkletRefMap({ _wvid: -1 }).current = 'ref1';
    getFromWorkletRefMap({ _wvid: -2 }).current = 'ref2';

    expect(getFromWorkletRefMap({ _wvid: -1 }).current).toBe('ref1');
    expect(getFromWorkletRefMap({ _wvid: -2 }).current).toBe('ref2');
    expect(getFromWorkletRefMap({ _wvid: -3 }).current).toBe(undefined);

    globalThis.lynxWorkletImpl._refImpl.updateWorkletRef({
      _wvid: -2,
    }, 'ref2-new');
    expect(getFromWorkletRefMap({ _wvid: -2 }).current.element).toBe(
      'ref2-new',
    );

    globalThis.lynxWorkletImpl._refImpl.updateWorkletRef({
      _wvid: -2,
    }, null);
    expect(getFromWorkletRefMap({ _wvid: -2 }).current).toBe(null);
  });

  it('should hydrate', () => {
    const firstScreenWorklet = {
      _wkltId: 'ctx1',
      _c: {
        ref1: {
          _wvid: -1,
          _initValue: 'main-thread-init-1',
        },
        ref2: {
          _wvid: -2,
          _initValue: 'main-thread-init-2',
        },
        ref3: {
          _wvid: -3,
          _initValue: 'main-thread-init-3',
        },
        ref5: {
          _wvid: -5,
          _initValue: 'main-thread-init-5',
        },
        ref6: {
          _wvid: -6,
          _initValue: 'main-thread-init-6',
        },
      },
    };
    const worklet = {
      _wkltId: 'ctx1',
      _c: {
        ref1: {
          _wvid: 1,
          _initValue: 'background-thread-init-1',
        },
        ref2: {
          _wvid: 2,
          _initValue: 'background-thread-init-2',
        },
        ref3: {
          _wvid: 3,
          _initValue: 'background-thread-init-3',
        },
        ref4: {
          _wvid: 4,
          _initValue: 'background-thread-init-4',
        },
        ref5: {
          _wvid: 5,
          _initValue: 'background-thread-init-5',
        },
      },
    };
    // If the refs are not used in the first screen, they will not be hydrated
    globalThis.lynxWorkletImpl._hydrateCtx(worklet, firstScreenWorklet);
    expect(getFromWorkletRefMap({ _wvid: 1 })).toBeUndefined();
    expect(getFromWorkletRefMap({ _wvid: 2 })).toBeUndefined();
    expect(getFromWorkletRefMap({ _wvid: 3 })).toBeUndefined();
    expect(globalThis.lynxWorkletImpl._refImpl._firstScreenWorkletRefMap)
      .toMatchInlineSnapshot(`{}`);

    // If the refs are used in the first screen, they will be hydrated
    globalThis.registerWorklet('main-thread', 'ctx1', function() {
      const { ref1, ref2 } = this._c;
      ref1.current = 'main-thread-set-1';
      ref2.current;
    });
    globalThis.runWorklet(firstScreenWorklet, []);
    updateWorkletRefInitValueChanges([
      [1, 'background-thread-init-1'],
      [2, 'background-thread-init-2'],
      [3, 'background-thread-init-3'],
      [4, 'background-thread-init-4'],
      [5, 'background-thread-init-5'],
    ]);
    globalThis.lynxWorkletImpl._hydrateCtx(worklet, firstScreenWorklet);
    globalThis.lynxWorkletImpl._refImpl.updateWorkletRef({
      _wvid: 5,
      _initValue: 'background-thread-init-5',
    }, 'background-thread-element-5');
    expect(getFromWorkletRefMap({ _wvid: 1 }).current).toBe(
      'main-thread-set-1',
    );
    expect(getFromWorkletRefMap({ _wvid: 2 }).current).toBe(
      'main-thread-init-2',
    );
    expect(getFromWorkletRefMap({ _wvid: 3 }).current).toBe(
      'main-thread-init-3',
    );
    expect(getFromWorkletRefMap({ _wvid: 4 }).current).toBe(
      'background-thread-init-4',
    );
    expect(getFromWorkletRefMap({ _wvid: 5 }).current.element).toBe(
      'background-thread-element-5',
    );
    expect(globalThis.lynxWorkletImpl._refImpl._firstScreenWorkletRefMap)
      .toMatchInlineSnapshot(`
      {
        "-1": {
          "_wvid": -1,
          "current": "main-thread-set-1",
        },
        "-2": {
          "_wvid": -2,
          "current": "main-thread-init-2",
        },
        "-3": {
          "_wvid": -3,
          "current": "main-thread-init-3",
        },
        "-5": {
          "_wvid": -5,
          "current": Element {
            "element": "background-thread-element-5",
          },
        },
        "-6": {
          "_wvid": -6,
          "current": "main-thread-init-6",
        },
      }
    `);

    globalThis.lynxWorkletImpl._refImpl.clearFirstScreenWorkletRefMap();
    expect(globalThis.lynxWorkletImpl._refImpl._firstScreenWorkletRefMap)
      .toMatchInlineSnapshot(`{}`);
  });

  it('should hydrate in another ctx', () => {
    const firstScreenWorklet = {
      _wkltId: 'ctx1',
      _c: {
        ref1: {
          _wvid: -1,
          _initValue: 'main-thread-init-1',
        },
        ctx2: {
          _wkltId: 'ctx2',
          _c: {
            ref2: {
              _wvid: -2,
              _initValue: 'main-thread-init-2',
            },
          },
        },
      },
    };
    const worklet = {
      _wkltId: 'ctx1',
      _c: {
        ref1: {
          _wvid: 1,
          _initValue: 'background-thread-init-1',
        },
        ctx2: {
          _wkltId: 'ctx2',
          _c: {
            ref2: {
              _wvid: 2,
              _initValue: 'background-thread-init-2',
            },
          },
        },
      },
    };
    // If the refs are not used in the first screen, they will not be hydrated
    globalThis.lynxWorkletImpl._hydrateCtx(worklet, firstScreenWorklet);
    expect(getFromWorkletRefMap({ _wvid: 1 })).toBeUndefined();
    expect(getFromWorkletRefMap({ _wvid: 2 })).toBeUndefined();

    // If the refs are used in the first screen, they will be hydrated
    globalThis.registerWorklet('main-thread', 'ctx1', function() {
      const { ref1, ctx2 } = this._c;
      ref1.current = 'main-thread-set-1';
      ctx2();
    });
    globalThis.registerWorklet('main-thread', 'ctx2', function() {
      const { ref2 } = this._c;
      ref2.current = 'main-thread-set-2';
    });
    globalThis.runWorklet(firstScreenWorklet, []);
    updateWorkletRefInitValueChanges([[1, 'background-thread-init-1'], [
      2,
      'background-thread-init-2',
    ]]);
    globalThis.lynxWorkletImpl._hydrateCtx(worklet, firstScreenWorklet);
    expect(getFromWorkletRefMap({ _wvid: 1 }).current).toBe(
      'main-thread-set-1',
    );
    expect(getFromWorkletRefMap({ _wvid: 2 }).current).toBe(
      'main-thread-set-2',
    );
  });

  it('should not hydrate different ctxs', () => {
    const firstScreenWorklet = {
      _wkltId: 'ctx1',
      _c: {
        ref1: {
          _wvid: -1,
          _initValue: 'main-thread-init-1',
        },
        ctx2: {
          _wkltId: 'ctx2',
          _c: {
            ref2: {
              _wvid: -2,
              _initValue: 'main-thread-init-2',
            },
          },
        },
      },
    };
    const worklet = {
      _wkltId: 'ctx1',
      _c: {
        ref1: {
          _wvid: 1,
          _initValue: 'background-thread-init-1',
        },
        ctx2: {
          _wkltId: 'ctx-different',
          _c: {
            ref2: {
              _wvid: 2,
              _initValue: 'background-thread-init-2',
            },
          },
        },
      },
    };
    // If the refs are not used in the first screen, they will not be hydrated
    globalThis.lynxWorkletImpl._hydrateCtx(worklet, firstScreenWorklet);
    expect(getFromWorkletRefMap({ _wvid: 1 })).toBeUndefined();
    expect(getFromWorkletRefMap({ _wvid: 2 })).toBeUndefined();

    // If the refs are used in the first screen, they will be hydrated
    globalThis.registerWorklet('main-thread', 'ctx1', function() {
      const { ref1, ctx2 } = this._c;
      ref1.current = 'main-thread-set-1';
      ctx2();
    });
    globalThis.registerWorklet('main-thread', 'ctx2', function() {
      const { ref2 } = this._c;
      ref2.current = 'main-thread-set-2';
    });
    globalThis.runWorklet(firstScreenWorklet, []);
    updateWorkletRefInitValueChanges([[1, 'background-thread-init-1'], [
      2,
      'background-thread-init-2',
    ]]);
    globalThis.lynxWorkletImpl._hydrateCtx(worklet, firstScreenWorklet);
    expect(getFromWorkletRefMap({ _wvid: 1 }).current).toBe(
      'main-thread-set-1',
    );
    expect(getFromWorkletRefMap({ _wvid: 2 }).current).toBe(
      'background-thread-init-2',
    );
  });
});
