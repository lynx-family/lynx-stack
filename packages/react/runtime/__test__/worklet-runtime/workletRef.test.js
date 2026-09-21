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

describe('MainThreadObject integration with the worklet ref map', () => {
  it('continues applying a patch after a MainThreadObject factory error', () => {
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/throws',
      () => {
        throw new Error('factory failed');
      },
    );

    expect(() => {
      updateWorkletRefInitValueChanges([
        [10, 42, '@test/throws'],
        [11, 'unrelated MainThreadRef'],
      ]);
    }).toThrow('factory failed');
    expect(getFromWorkletRefMap({ _wvid: 11 }).current).toBe(
      'unrelated MainThreadRef',
    );
  });

  it('hydrates a used first-screen main-thread object into the background id', () => {
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/value',
      value => ({ get: () => value }),
    );
    const firstScreenWorklet = {
      _wkltId: 'typed-value',
      _c: {
        value: {
          _wvid: -1,
          _initValue: 42,
          _type: '@test/value',
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
        },
      },
    };
    globalThis.registerWorklet('main-thread', 'typed-value', function() {
      return this._c.value.get();
    });

    expect(globalThis.runWorklet(firstScreenWorklet, [])).toBe(42);
    const firstScreenValue = firstScreenWorklet._c.value;
    updateWorkletRefInitValueChanges([[1, 42, '@test/value']]);
    const redundantValue = getFromWorkletRefMap({ _wvid: 1 });
    expect(isHydratedWorkletValue(redundantValue)).toBe(true);
    globalThis.lynxWorkletImpl._hydrateCtx(worklet, firstScreenWorklet);

    expect(getFromWorkletRefMap({ _wvid: 1 })).toBe(firstScreenValue);
    expect(isHydratedWorkletValue(redundantValue)).toBe(false);
    expect(isHydratedWorkletValue(firstScreenValue)).toBe(true);

    removeValueFromWorkletRefMap(1);
    expect(getFromWorkletRefMap({ _wvid: 1 })).toBeUndefined();
    expect(isHydratedWorkletValue(firstScreenValue)).toBe(false);
  });

  it('does not hydrate an unused first-screen main-thread object', () => {
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/unused-value',
      value => ({ value }),
    );
    const firstScreenWorklet = {
      _wkltId: 'unused-typed-value',
      _c: {
        value: {
          _wvid: -1,
          _initValue: 42,
          _type: '@test/unused-value',
        },
      },
    };
    const worklet = {
      _wkltId: 'unused-typed-value',
      _c: {
        value: {
          _wvid: 1,
          _initValue: 42,
          _type: '@test/unused-value',
        },
      },
    };

    globalThis.lynxWorkletImpl._hydrateCtx(worklet, firstScreenWorklet);

    expect(getFromWorkletRefMap({ _wvid: 1 })).toBeUndefined();
  });

  it('hydrates a compatible mutable worklet value through the typed path', () => {
    const firstScreenWorklet = {
      _wkltId: 'typed-mutable-value',
      _c: {
        value: {
          _wvid: -1,
          _initValue: { nested: { _wvid: -2, _initValue: 42, _type: 'main-thread' } },
          _type: 'main-thread',
        },
      },
    };
    const worklet = {
      _wkltId: 'typed-mutable-value',
      _c: {
        value: {
          _wvid: 1,
          _initValue: 42,
          _type: 'main-thread',
        },
      },
    };
    globalThis.registerWorklet('main-thread', 'typed-mutable-value', function() {
      return this._c.value.current;
    });

    globalThis.runWorklet(firstScreenWorklet, []);
    const firstScreenValue = firstScreenWorklet._c.value;
    expect(firstScreenValue.current.nested.current).toBe(42);
    globalThis.lynxWorkletImpl._hydrateCtx(worklet, firstScreenWorklet);

    expect(getFromWorkletRefMap({ _wvid: 1 })).toBe(firstScreenValue);
  });

  it('releases abandoned first-screen main-thread object metadata', () => {
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/abandoned',
      value => ({ value }),
    );
    const firstScreenWorklet = {
      _wkltId: 'abandoned-typed-value',
      _c: {
        value: {
          _wvid: -1,
          _initValue: 42,
          _type: '@test/abandoned',
        },
      },
    };
    globalThis.registerWorklet('main-thread', 'abandoned-typed-value', function() {
      return this._c.value;
    });

    const value = globalThis.runWorklet(firstScreenWorklet, []);
    expect(isHydratedWorkletValue(value)).toBe(true);

    globalThis.lynxWorkletImpl._refImpl.clearFirstScreenWorkletRefMap();
    expect(isHydratedWorkletValue(value)).toBe(false);
  });

  it('releases typed objects whose shape resembles a mutable cell', () => {
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/mutable-cell-shaped-object',
      () => ({ _wvid: 91, current: 0 }),
    );
    updateWorkletRefInitValueChanges([
      [91, null, '@test/mutable-cell-shaped-object'],
    ]);
    const value = getFromWorkletRefMap({ _wvid: 91 });
    expect(isHydratedWorkletValue(value)).toBe(true);

    removeValueFromWorkletRefMap(91);

    expect(getFromWorkletRefMap({ _wvid: 91 })).toBeUndefined();
    // The structural mutable-cell check still recognizes this shape after the
    // typed-object metadata is released. Reusing it as a mutable cell proves
    // that the authoritative typed-object metadata itself was removed.
    globalThis.lynxWorkletImpl._refImpl._workletRefMap[92] = value;
    expect(() => updateWorkletRefInitValueChanges([[92, null, 'main-thread']])).not.toThrow();
  });

  it('does not hydrate worklet metadata found inside object payloads', () => {
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/atomic-hydration-payload',
      value => ({ value }),
    );
    const unrelatedRef = { _wvid: 3, current: 'unrelated' };
    globalThis.lynxWorkletImpl._refImpl._workletRefMap[3] = unrelatedRef;
    const payload = { _wvid: 3, current: 'payload' };
    const worklet = {
      _wkltId: 'atomic-hydration-payload',
      _c: {
        value: {
          _wvid: 92,
          _initValue: payload,
          _type: '@test/atomic-hydration-payload',
        },
      },
    };
    const firstScreenWorklet = {
      _wkltId: 'atomic-hydration-payload',
      _c: {
        value: {
          _wvid: -92,
          _initValue: payload,
          _type: '@test/atomic-hydration-payload',
        },
      },
    };

    globalThis.lynxWorkletImpl._hydrateCtx(worklet, firstScreenWorklet);

    expect(globalThis.lynxWorkletImpl._refImpl._workletRefMap[3]).toBe(
      unrelatedRef,
    );
    expect(getFromWorkletRefMap({ _wvid: 92 })).toBeUndefined();
  });

  it('rejects different typed-object keys at the same hydration path', () => {
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/main-type',
      value => ({ value }),
    );
    const firstScreenWorklet = {
      _wkltId: 'macro-typed-value',
      _c: {
        value: {
          _wvid: -1,
          _initValue: 1,
          _type: '@test/main-type',
        },
      },
    };
    const worklet = {
      _wkltId: 'macro-typed-value',
      _c: {
        value: {
          _wvid: 1,
          _initValue: 2,
          _type: '@test/background-type',
        },
      },
    };
    globalThis.registerWorklet('main-thread', 'macro-typed-value', function() {
      return this._c.value.value;
    });

    expect(globalThis.runWorklet(firstScreenWorklet, [])).toBe(1);
    expect(() => {
      globalThis.lynxWorkletImpl._hydrateCtx(worklet, firstScreenWorklet);
    }).toThrow(
      'MainThreadObject type mismatch during hydration for handle 1: background handle expects type "@test/background-type", but the main-thread target is type "@test/main-type".',
    );
    expect(getFromWorkletRefMap({ _wvid: 1 })).toBeUndefined();
  });

  it('rejects typed-object and mutable-cell kind mismatches during hydration', () => {
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/value',
      value => ({ value }),
    );
    const firstScreenWorklet = {
      _wkltId: 'kind-mismatch',
      _c: {
        value: {
          _wvid: -1,
          _initValue: 1,
          _type: '@test/value',
        },
      },
    };
    const worklet = {
      _wkltId: 'kind-mismatch',
      _c: {
        value: {
          _wvid: 1,
          _initValue: 1,
          _type: 'main-thread',
        },
      },
    };
    globalThis.registerWorklet('main-thread', 'kind-mismatch', function() {
      return this._c.value.value;
    });

    globalThis.runWorklet(firstScreenWorklet, []);
    expect(() => {
      globalThis.lynxWorkletImpl._hydrateCtx(worklet, firstScreenWorklet);
    }).toThrow(
      'Worklet value kind mismatch during hydration for handle 1: background handle expects mutable-cell, but the main-thread target is typed-object.',
    );
  });

  it('validates an existing hydrated target when applying initialization patches', () => {
    globalThis.lynxWorkletImpl._refImpl.registerMainThreadObjectType(
      '@test/value',
      value => ({ value }),
    );
    const firstScreenWorklet = {
      _wkltId: 'patch-validation',
      _c: {
        value: {
          _wvid: -1,
          _initValue: 1,
          _type: '@test/value',
        },
      },
    };
    const worklet = {
      _wkltId: 'patch-validation',
      _c: {
        value: {
          _wvid: 1,
          _initValue: 1,
          _type: '@test/value',
        },
      },
    };
    globalThis.registerWorklet('main-thread', 'patch-validation', function() {
      return this._c.value.value;
    });

    globalThis.runWorklet(firstScreenWorklet, []);
    globalThis.lynxWorkletImpl._hydrateCtx(worklet, firstScreenWorklet);
    expect(() => {
      updateWorkletRefInitValueChanges([[1, 1, '@test/other-value']]);
    }).toThrow(
      'MainThreadObject type mismatch during initialization patch for handle 1: background handle expects type "@test/other-value", but the main-thread target is type "@test/value".',
    );
    const hydratedValue = getFromWorkletRefMap({ _wvid: 1 });
    expect(hydratedValue).toBe(firstScreenWorklet._c.value);
    updateWorkletRefInitValueChanges([[1, 1, '@test/value']]);
    expect(getFromWorkletRefMap({ _wvid: 1 })).toBe(hydratedValue);
  });

  it('rejects an existing target without worklet-value metadata', () => {
    globalThis.lynxWorkletImpl._refImpl._workletRefMap[1] = {};

    expect(() => {
      updateWorkletRefInitValueChanges([[1, 'value']]);
    }).toThrow(
      'Cannot apply MainThreadObject initialization patch for handle 1: the existing target has no worklet-value metadata.',
    );
  });

  it('does not mistake a source MainThreadRef accessor for a mutable cell', () => {
    const sourceHandle = Object.create({
      get current() {
        throw new Error('source accessor must not be read');
      },
    });
    sourceHandle._wvid = -1;

    expect(isHydratedWorkletValue(sourceHandle)).toBe(false);
    expect(isHydratedWorkletValue({ _wvid: -1, current: null })).toBe(true);
  });
});

describe('WorkletRef', () => {
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
    globalThis.lynxWorkletImpl._refImpl._workletRefMap[98] = {};
    expect(() => removeValueFromWorkletRefMap(98)).not.toThrow();
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
