// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Element } from '../src/api/element';
import { initApiEnv } from '../src/api/lynxApi';
import { RunWorkletSource } from '../src/bindings/types';
import { MainThreadRef } from '../src/Ref';
import { updateWorkletRefInitValueChanges } from '../src/workletRef';
import { initWorklet } from '../src/workletRuntime';

describe('Worklet', () => {
  const consoleMock = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  beforeEach(() => {
    globalThis.SystemInfo = {
      lynxSdkVersion: '2.16',
    };
    delete globalThis.lynxWorkletImpl;
    globalThis.lynx = {
      ...globalThis.lynx,
      requestAnimationFrame: vi.fn(),
    };
    // Re-register MainThreadRef for each test since initWorklet consumes the registry
    globalThis.__LYNX_MTV_REGISTRY__ = {
      'main-thread': MainThreadRef,
    };
    initApiEnv();
  });

  afterAll(() => {
    consoleMock.mockReset();
  });

  it('worklet should be called', () => {
    initWorklet();

    const fn = vi.fn();
    globalThis.registerWorklet('main-thread', '1', fn);
    let worklet = {
      _wkltId: '1',
    };
    globalThis.runWorklet(worklet);
    expect(fn).toBeCalled();
  });

  it('worklet should be called with arguments', async () => {
    initWorklet();

    const fn = vi.fn(function(event) {
      const { abc, wv } = this._c;
      let { _jsFn1 } = this._jsFn;
      globalThis.lynxWorkletImpl._workletMap['1'].bind(this);
      expect(event).toBe(1);
      expect(abc).toBe(22);
      expect(wv.current).toBe(333);
      expect(_jsFn1).toMatchInlineSnapshot(`
        {
          "_execId": 666,
          "_jsFnId": 1,
        }
      `);
    });
    globalThis.registerWorklet('main-thread', '1', fn);
    updateWorkletRefInitValueChanges([[178, 333]]);

    let wv = {
      _wvid: 178,
      _type: 'main-thread',
    };

    let worklet = {
      _c: {
        abc: 22,
        wv: wv,
      },
      _jsFn: {
        _jsFn1: {
          _jsFnId: 1,
        },
      },
      _wkltId: '1',
      _execId: 666,
    };
    globalThis.runWorklet(worklet, [1]);
    expect(fn).toBeCalled();
  });

  it('should support calling another worklet', async () => {
    initWorklet();

    const fn2 = vi.fn(function(arg1, arg2) {
      const { wv } = this._c;
      globalThis.lynxWorkletImpl._workletMap['2'].bind(this);
      expect(arg1).toBe(1);
      expect(arg2.current).toBe(22);
      expect(wv.current).toBe(333);
    });
    globalThis.registerWorklet('main-thread', '2', fn2);
    updateWorkletRefInitValueChanges([
      [1, 333],
      [2, 22],
    ]);

    const fn1 = vi.fn(function(arg2) {
      const { worklet2, arg1 } = this._c;
      globalThis.lynxWorkletImpl._workletMap['1'].bind(this);
      worklet2(arg1, arg2);
    });
    globalThis.registerWorklet('main-thread', '1', fn1);

    let wv = {
      _wvid: 1,
      _type: 'main-thread',
    };

    let worklet2 = {
      _c: {
        wv: wv,
      },
      _wkltId: '2',
    };

    let worklet = {
      _c: {
        worklet2: worklet2,
        arg1: 1,
      },
      _wkltId: '1',
    };

    let arg2 = {
      _wvid: 2,
    };
    globalThis.runWorklet(worklet, [arg2]);
    expect(globalThis.lynxWorkletImpl._workletMap['2']).toBeCalled();
  });

  it('should call recursively', async () => {
    initWorklet();

    const fn = vi.fn(function() {
      const { wv1 } = this._c;
      const worklet = globalThis.lynxWorkletImpl._workletMap['1'].bind(this);
      if (++wv1.current < 5) {
        worklet(wv1.current);
      }
    });
    globalThis.registerWorklet('main-thread', '1', fn);
    updateWorkletRefInitValueChanges([[1, 0]]);

    let wv1 = {
      _wvid: 1,
      _type: 'main-thread',
    };

    let worklet = {
      _c: {
        wv1: wv1,
      },
      _wkltId: '1',
    };
    globalThis.runWorklet(worklet, []);
    expect(fn).toHaveBeenLastCalledWith(4);
  });

  it('value of a workletRef should be preserved between calls', async () => {
    initWorklet();

    let value = 0;
    const fn = vi.fn(function() {
      const { wv1 } = this._c;
      globalThis.lynxWorkletImpl._workletMap['1'].bind(this);
      value = ++wv1.current;
    });
    globalThis.registerWorklet('main-thread', '1', fn);
    updateWorkletRefInitValueChanges([[1, 0]]);

    let worklet = {
      _c: {
        wv1: {
          _wvid: 1,
          _type: 'main-thread',
        },
      },
      _wkltId: '1',
    };
    globalThis.runWorklet(worklet, []);
    globalThis.runWorklet(worklet, []);
    globalThis.runWorklet(worklet, []);
    globalThis.runWorklet(worklet, []);
    globalThis.runWorklet(worklet, []);
    expect(value).toBe(5);
  });

  it('should support various types of parameters', async () => {
    initWorklet();

    globalThis.lynxWorkletImpl._workletMap['1'] = vi.fn(function(
      argNull,
      argUndefined,
      argNumber,
      argString,
      argArray,
      argObject,
      argWorklet,
      argWorkletRef,
      argElement,
    ) {
      globalThis.lynxWorkletImpl._workletMap['1'].bind(this);
      expect(argNull).toBe(null);
      expect(argUndefined).toBe(undefined);
      expect(argNumber).toBe(888);
      expect(argString).toBe('str3');
      expect(argArray[0]).toStrictEqual(3);
      expect(argArray[1]).toStrictEqual([4]);
      expect(argArray[2].current).toStrictEqual(5);
      expect(argObject).toStrictEqual({ str: 'str5' });
      expect(argElement).toBeInstanceOf(Element);
      argWorklet(
        argNull,
        argUndefined,
        argNumber,
        argString,
        argArray,
        argObject,
        argWorkletRef,
        argElement,
      );
      expect(argWorkletRef.current).toBe(444);
    });

    globalThis.lynxWorkletImpl._workletMap['arg'] = vi.fn(function(
      argNull,
      argUndefined,
      argNumber,
      argString,
      argArray,
      argObject,
      argWorkletRef,
      argElement,
    ) {
      globalThis.lynxWorkletImpl._workletMap['arg'].bind(this);
      expect(argNull).toBe(null);
      expect(argUndefined).toBe(undefined);
      expect(argNumber).toBe(888);
      expect(argString).toBe('str3');
      expect(argArray[0]).toStrictEqual(3);
      expect(argArray[1]).toStrictEqual([4]);
      expect(argArray[2].current).toStrictEqual(5);
      expect(argObject).toStrictEqual({ str: 'str5' });
      expect(argWorkletRef.current).toBe(444);
      expect(argElement).toBeInstanceOf(Element);
    });

    updateWorkletRefInitValueChanges([
      [1, 444],
      [2, 5],
    ]);

    let argWorkletRef = {
      _wvid: 1,
      _type: 'main-thread',
    };

    let wv5 = {
      _wvid: 2,
      _type: 'main-thread',
    };

    let worklet = {
      _c: {},
      _wkltId: '1',
    };

    let argWorklet = {
      _c: {},
      _wkltId: 'arg',
    };

    let argElement = {
      elementRefptr: 'element',
    };

    globalThis.runWorklet(worklet, [
      null,
      undefined,
      888,
      'str3',
      [3, [4], wv5],
      { str: 'str5' },
      argWorklet,
      argWorkletRef,
      argElement,
    ]);
    expect(globalThis.lynxWorkletImpl._workletMap['arg']).toBeCalled();
  });

  it('should not throw when invalid worklet ctx', () => {
    initWorklet();
    globalThis.runWorklet({});
    expect(consoleMock).lastCalledWith('Worklet: Invalid worklet object: {}');
    globalThis.runWorklet(undefined);
    expect(consoleMock).lastCalledWith('Worklet: Invalid worklet object: undefined');
    globalThis.runWorklet(null);
    expect(consoleMock).lastCalledWith('Worklet: Invalid worklet object: null');
    globalThis.runWorklet(1);
    expect(consoleMock).lastCalledWith('Worklet: Invalid worklet object: 1');
  });

  it('should not throw when depth of argument exceeds limit', () => {
    const a = {};
    a.a = a;
    initWorklet();
    globalThis.registerWorklet('main-thread', '1', vi.fn());
    expect(() => {
      globalThis.runWorklet({ _wkltId: '1' }, [a]);
    }).toThrow(new Error('Depth of value exceeds limit of 1000.'));
  });

  it('should not throw with nested worklet', () => {
    initWorklet();
    const worklet1 = vi.fn();
    const worklet2 = vi.fn();
    globalThis.registerWorklet('main-thread', '1', worklet1);
    globalThis.registerWorklet('main-thread', '2', worklet2);

    const element = {
      _parent: null,
    };
    element._parent = element;

    const ref = { elementRefptr: element };

    const worklet1Ctx = {
      _wkltId: '1',
      _c: ref,
    };

    globalThis.runWorklet(worklet1Ctx, [1]);
    expect(worklet1).toBeCalledWith(1);

    const worklet2Ctx = {
      _wkltId: '2',
      _c: { worklet1: worklet1Ctx },
    };

    globalThis.runWorklet(worklet2Ctx, [2]);
    expect(worklet2).toBeCalledWith(2);
  });

  it('event object should have stopPropagation and stopImmediatePropagation', async () => {
    initWorklet();
    const fn = vi.fn(function(event) {
      globalThis.lynxWorkletImpl._workletMap['1'].bind(this);
      expect(event.stopPropagation).toBeDefined();
      expect(event.stopImmediatePropagation).toBeDefined();
    });
    globalThis.registerWorklet('main-thread', '1', fn);
    globalThis.runWorklet({ _wkltId: '1' }, [{
      target: {},
      currentTarget: {},
    }], {
      source: RunWorkletSource.EVENT,
    });
  });

  it('event object should have returnValue wrapped', async () => {
    initWorklet();
    const fn = vi.fn(function() {
      globalThis.lynxWorkletImpl._workletMap['1'].bind(this);

      return 1;
    });

    globalThis.registerWorklet('main-thread', '1', fn);
    const ret = globalThis.runWorklet({ _wkltId: '1' }, [{
      target: {},
      currentTarget: {},
    }], {
      source: RunWorkletSource.EVENT,
    });

    expect(ret).toMatchObject({
      returnValue: 1,
      eventReturnResult: undefined,
    });
  });

  it('non event object should not have returnValue wrapped', async () => {
    initWorklet();
    const fn = vi.fn(function() {
      globalThis.lynxWorkletImpl._workletMap['1'].bind(this);

      return 1;
    });

    globalThis.registerWorklet('main-thread', '1', fn);
    const ret = globalThis.runWorklet({ _wkltId: '1' }, [1, 2]);

    expect(ret).toBe(1);
  });

  it('should support __MT_PERSIST__ marked objects as main thread values', async () => {
    initWorklet();
    updateWorkletRefInitValueChanges([[99, { initialized: true }]]);

    const fn = vi.fn(function() {
      const { mtValue } = this._c;
      globalThis.lynxWorkletImpl._workletMap['1'].bind(this);
      // The mtValue should be hydrated from the worklet ref map
      expect(mtValue.current).toEqual({ initialized: true });
      // Modify it to verify it's a real main thread value
      mtValue.current = { modified: true };
    });
    globalThis.registerWorklet('main-thread', '1', fn);

    // Object with __MT_PERSIST__ marker and _wvid
    const mtValue = {
      __MT_PERSIST__: true,
      _wvid: 99,
      _initValue: { initialized: true },
      _type: 'main-thread',
    };

    const worklet = {
      _c: {
        mtValue: mtValue,
      },
      _wkltId: '1',
    };

    globalThis.runWorklet(worklet, []);
    expect(fn).toBeCalled();

    // Run again to verify state is preserved
    const fn2 = vi.fn(function() {
      const { mtValue } = this._c;
      globalThis.lynxWorkletImpl._workletMap['2'].bind(this);
      expect(mtValue.current).toEqual({ modified: true });
    });
    globalThis.registerWorklet('main-thread', '2', fn2);

    const worklet2 = {
      _c: {
        mtValue: mtValue,
      },
      _wkltId: '2',
    };

    globalThis.runWorklet(worklet2, []);
    expect(fn2).toBeCalled();
  });

  it('requestAnimationFrame should throw error before 2.16', async () => {
    globalThis.SystemInfo = {
      lynxSdkVersion: '2.15',
    };
    initWorklet();

    const fn = vi.fn(function() {
      globalThis.lynxWorkletImpl._workletMap['1'].bind(this);
      expect(() => {
        globalThis.requestAnimationFrame(vi.fn());
      }).toThrow(
        new Error(
          'requestAnimationFrame in main thread script requires Lynx sdk version 2.16',
        ),
      );
      expect(() => {
        globalThis.lynx.requestAnimationFrame(vi.fn());
      }).toThrow(
        new Error(
          'requestAnimationFrame in main thread script requires Lynx sdk version 2.16',
        ),
      );
    });
    globalThis.registerWorklet('main-thread', '1', fn);
    updateWorkletRefInitValueChanges([[178, 333]]);

    let worklet = {
      _wkltId: '1',
    };
    globalThis.runWorklet(worklet, [1]);
    expect(fn).toBeCalled();
  });

  it('requestAnimationFrame should throw error before 2.16 2', async () => {
    globalThis.SystemInfo = {};
    initWorklet();

    const fn = vi.fn(function() {
      globalThis.lynxWorkletImpl._workletMap['1'].bind(this);
      expect(() => {
        globalThis.requestAnimationFrame(vi.fn());
      }).toThrow(
        new Error(
          'requestAnimationFrame in main thread script requires Lynx sdk version 2.16',
        ),
      );
      expect(() => {
        globalThis.lynx.requestAnimationFrame(vi.fn());
      }).toThrow(
        new Error(
          'requestAnimationFrame in main thread script requires Lynx sdk version 2.16',
        ),
      );
    });
    globalThis.registerWorklet('main-thread', '1', fn);
    updateWorkletRefInitValueChanges([[178, 333]]);

    let worklet = {
      _wkltId: '1',
    };
    globalThis.runWorklet(worklet, [1]);
    expect(fn).toBeCalled();
  });
});
