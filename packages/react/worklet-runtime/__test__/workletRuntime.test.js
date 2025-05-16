// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { initApiEnv } from '../src/api/lynxApi';
import { currentCtx } from '../src/ctxTrace';
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
      requestAnimationFrame: vi.fn(),
    };
    initApiEnv();
  });

  afterAll(() => {
    consoleMock.mockReset();
  });

  it('worklet should be called', async () => {
    initWorklet();

    const fn = vi.fn();
    registerWorklet('main-thread', '1', fn);
    let worklet = {
      _wkltId: '1',
    };
    runWorklet(worklet);
    expect(fn).toBeCalled();
  });

  it('worklet should be called with arguments', async () => {
    initWorklet();

    const fn = vi.fn(function(event) {
      const { abc, wv } = this._c;
      let { _jsFn1 } = this._jsFn;
      const worklet = lynxWorkletImpl._workletMap['1'].bind(this);
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
    registerWorklet('main-thread', '1', fn);
    updateWorkletRefInitValueChanges([[178, 333]]);

    let wv = {
      _wvid: 178,
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
    runWorklet(worklet, [1]);
    expect(fn).toBeCalled();
  });

  it('should support calling another worklet', async () => {
    initWorklet();

    const fn2 = vi.fn(function(arg1, arg2) {
      const { wv } = this._c;
      const worklet2 = lynxWorkletImpl._workletMap['2'].bind(this);
      expect(arg1).toBe(1);
      expect(arg2.current).toBe(22);
      expect(wv.current).toBe(333);
    });
    registerWorklet('main-thread', '2', fn2);
    updateWorkletRefInitValueChanges([
      [1, 333],
      [2, 22],
    ]);

    const fn1 = vi.fn(function(arg2) {
      const { worklet2, arg1 } = this._c;
      const worklet = lynxWorkletImpl._workletMap['1'].bind(this);
      worklet2(arg1, arg2);
    });
    registerWorklet('main-thread', '1', fn1);

    let wv = {
      _wvid: 1,
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
    runWorklet(worklet, [arg2]);
    expect(lynxWorkletImpl._workletMap['2']).toBeCalled();
  });

  it('should call recursively', async () => {
    initWorklet();

    const fn = vi.fn(function(x) {
      const { wv1 } = this._c;
      const worklet = lynxWorkletImpl._workletMap['1'].bind(this);
      if (++wv1.current < 5) {
        worklet(wv1.current);
      }
    });
    registerWorklet('main-thread', '1', fn);
    updateWorkletRefInitValueChanges([[1, 0]]);

    let wv1 = {
      _wvid: 1,
    };

    let worklet = {
      _c: {
        wv1: wv1,
      },
      _wkltId: '1',
    };
    runWorklet(worklet, []);
    expect(fn).toHaveBeenLastCalledWith(4);
  });

  it('should track current worklet ctx', async () => {
    initWorklet();

    const fn = vi.fn(() => {
      expect(currentCtx.ctx._wkltId).toEqual('1');
    });
    registerWorklet('main-thread', '1', fn);
    let worklet = {
      _wkltId: '1',
    };
    runWorklet(worklet);
    expect(fn).toBeCalled();
    expect(currentCtx).toBeUndefined();
  });

  it('value of a workletRef should be preserved between calls', async () => {
    initWorklet();

    let value = 0;
    const fn = vi.fn(function() {
      const { wv1 } = this._c;
      const worklet = lynxWorkletImpl._workletMap['1'].bind(this);
      value = ++wv1.current;
    });
    registerWorklet('main-thread', '1', fn);
    updateWorkletRefInitValueChanges([[1, 0]]);

    let worklet = {
      _c: {
        wv1: {
          _wvid: 1,
        },
      },
      _wkltId: '1',
    };
    runWorklet(worklet, []);
    runWorklet(worklet, []);
    runWorklet(worklet, []);
    runWorklet(worklet, []);
    runWorklet(worklet, []);
    expect(value).toBe(5);
  });

  it('should support various types of parameters', async () => {
    initWorklet();

    let value = 0;
    lynxWorkletImpl._workletMap['1'] = vi.fn(function(
      argNull,
      argUndefined,
      argNumber,
      argString,
      argArray,
      argObject,
      argWorklet,
      argWorkletRef,
    ) {
      const worklet = lynxWorkletImpl._workletMap['1'].bind(this);
      expect(argNull).toBe(null);
      expect(argUndefined).toBe(undefined);
      expect(argNumber).toBe(888);
      expect(argString).toBe('str3');
      expect(argArray[0]).toStrictEqual(3);
      expect(argArray[1]).toStrictEqual([4]);
      expect(argArray[2].current).toStrictEqual(5);
      expect(argObject).toStrictEqual({ str: 'str5' });
      argWorklet(
        argNull,
        argUndefined,
        argNumber,
        argString,
        argArray,
        argObject,
        argWorkletRef,
      );
      expect(argWorkletRef.current).toBe(444);
    });

    lynxWorkletImpl._workletMap['arg'] = vi.fn(function(
      argNull,
      argUndefined,
      argNumber,
      argString,
      argArray,
      argObject,
      argWorkletRef,
    ) {
      const argWorklet = lynxWorkletImpl._workletMap['arg'].bind(this);
      expect(argNull).toBe(null);
      expect(argUndefined).toBe(undefined);
      expect(argNumber).toBe(888);
      expect(argString).toBe('str3');
      expect(argArray[0]).toStrictEqual(3);
      expect(argArray[1]).toStrictEqual([4]);
      expect(argArray[2].current).toStrictEqual(5);
      expect(argObject).toStrictEqual({ str: 'str5' });
      expect(argWorkletRef.current).toBe(444);
    });

    updateWorkletRefInitValueChanges([
      [1, 444],
      [2, 5],
    ]);

    let argWorkletRef = {
      _wvid: 1,
    };

    let wv5 = {
      _wvid: 2,
    };

    let worklet = {
      _c: {},
      _wkltId: '1',
    };

    let argWorklet = {
      _c: {},
      _wkltId: 'arg',
    };

    runWorklet(worklet, [
      null,
      undefined,
      888,
      'str3',
      [3, [4], wv5],
      { str: 'str5' },
      argWorklet,
      argWorkletRef,
    ]);
    expect(lynxWorkletImpl._workletMap['arg']).toBeCalled();
  });

  it('should not throw when invalid worklet ctx', () => {
    initWorklet();
    runWorklet({});
    expect(consoleMock).lastCalledWith('Worklet: Invalid worklet object: {}');
    runWorklet(undefined);
    expect(consoleMock).lastCalledWith('Worklet: Invalid worklet object: undefined');
    runWorklet(null);
    expect(consoleMock).lastCalledWith('Worklet: Invalid worklet object: null');
    runWorklet(1);
    expect(consoleMock).lastCalledWith('Worklet: Invalid worklet object: 1');
  });

  it('should not throw when depth of argument exceeds limit', () => {
    const a = {};
    a.a = a;
    initWorklet();
    registerWorklet('main-thread', '1', () => {});
    expect(() => {
      runWorklet({ _wkltId: '1' }, [a]);
    }).toThrow(new Error('Depth of value exceeds limit of 1000.'));
  });
});

it('requestAnimationFrame should throw error before 2.16', async () => {
  globalThis.SystemInfo = {
    lynxSdkVersion: '2.15',
  };
  initWorklet();

  const fn = vi.fn(function(event) {
    const worklet = lynxWorkletImpl._workletMap['1'].bind(this);
    expect(() => {
      requestAnimationFrame(() => {});
    }).toThrow(
      new Error(
        'requestAnimationFrame in main thread script requires Lynx sdk version 2.16',
      ),
    );
    expect(() => {
      lynx.requestAnimationFrame(() => {});
    }).toThrow(
      new Error(
        'requestAnimationFrame in main thread script requires Lynx sdk version 2.16',
      ),
    );
  });
  registerWorklet('main-thread', '1', fn);
  updateWorkletRefInitValueChanges([[178, 333]]);

  let worklet = {
    _wkltId: '1',
  };
  runWorklet(worklet, [1]);
  expect(fn).toBeCalled();
});

it('requestAnimationFrame should throw error before 2.16 2', async () => {
  globalThis.SystemInfo = {};
  initWorklet();

  const fn = vi.fn(function(event) {
    const worklet = lynxWorkletImpl._workletMap['1'].bind(this);
    expect(() => {
      requestAnimationFrame(() => {});
    }).toThrow(
      new Error(
        'requestAnimationFrame in main thread script requires Lynx sdk version 2.16',
      ),
    );
    expect(() => {
      lynx.requestAnimationFrame(() => {});
    }).toThrow(
      new Error(
        'requestAnimationFrame in main thread script requires Lynx sdk version 2.16',
      ),
    );
  });
  registerWorklet('main-thread', '1', fn);
  updateWorkletRefInitValueChanges([[178, 333]]);

  let worklet = {
    _wkltId: '1',
  };
  runWorklet(worklet, [1]);
  expect(fn).toBeCalled();
});
