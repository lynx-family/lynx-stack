// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearConfigCacheForTesting } from '../../src/worklet/functionality';
import { destroyWorklet, lynxWorkletJsImpl, removeJsWorklets, runJSFunction } from '../../src/worklet/jsImpl';

beforeEach(() => {
  SystemInfo.lynxSdkVersion = '999.999';
});

afterEach(() => {
  destroyWorklet();
  vi.clearAllMocks();
});

describe('WorkletImpl', () => {
  it('should not get impl when native capabilities not available', () => {
    const lynx = globalThis.lynx;
    globalThis.lynx = {};
    expect(lynxWorkletJsImpl()).toBe(undefined);
    globalThis.lynx = lynx;
  });

  it('should get impl and destroy', () => {
    expect(lynxWorkletJsImpl()).toEqual(expect.any(Object));
    expect(lynx.getCoreContext().addEventListener).toHaveBeenCalledTimes(2);
    expect(lynxWorkletJsImpl()).toEqual(expect.any(Object));
    expect(lynx.getCoreContext().addEventListener).toHaveBeenCalledTimes(2);
    destroyWorklet();
    expect(lynx.getCoreContext().removeEventListener).toHaveBeenCalledTimes(2);
  });

  it('should not listen when not enableRunOnBackground', () => {
    clearConfigCacheForTesting();
    SystemInfo.lynxSdkVersion = '2.15';
    expect(lynxWorkletJsImpl()).toEqual(expect.any(Object));
    expect(lynx.getCoreContext().addEventListener).toHaveBeenCalledTimes(0);
    expect(lynxWorkletJsImpl()).toEqual(expect.any(Object));
    expect(lynx.getCoreContext().addEventListener).toHaveBeenCalledTimes(0);
    destroyWorklet();
    expect(lynx.getCoreContext().removeEventListener).toHaveBeenCalledTimes(0);
    clearConfigCacheForTesting();
  });

  it('should not listen when not enableRunOnBackground 2', () => {
    clearConfigCacheForTesting();
    SystemInfo.lynxSdkVersion = undefined;
    expect(lynxWorkletJsImpl()).toEqual(expect.any(Object));
    expect(lynx.getCoreContext().addEventListener).toHaveBeenCalledTimes(0);
    expect(lynxWorkletJsImpl()).toEqual(expect.any(Object));
    expect(lynx.getCoreContext().addEventListener).toHaveBeenCalledTimes(0);
    destroyWorklet();
    expect(lynx.getCoreContext().removeEventListener).toHaveBeenCalledTimes(0);
    clearConfigCacheForTesting();
  });
});

describe('runJSFunction', () => {
  it('should run JS Function', () => {
    const fn = vi.fn();
    const worklet = {
      xxx: {
        yyy: 1,
        zzz: {
          _jsFnId: 233,
          _fn: fn,
        },
      },
    };
    const id = lynxWorkletJsImpl()._workletExecIdMap.add(worklet);
    runJSFunction({
      data: JSON.stringify({
        obj: {
          _jsFnId: 233,
          _execId: id,
        },
        params: ['hello'],
      }),
    });
    expect(fn).toBeCalledWith('hello');

    removeJsWorklets({
      data: [id],
    });

    expect(() => {
      runJSFunction({
        data: JSON.stringify({
          obj: {
            _jsFnId: 233,
            _execId: id,
          },
          params: ['hello'],
        }),
      });
    }).toThrow('runOnBackground: JS function not found: {"_jsFnId":233,"_execId":1}');
  });

  it('should return when native capabilities not available', () => {
    const coreContext = lynx.getCoreContext;
    lynx.getCoreContext = undefined;

    runJSFunction({
      data: JSON.stringify({
        obj: {
          _jsFnId: 233,
          _execId: 1,
        },
        params: ['hello'],
      }),
    });

    removeJsWorklets({
      data: [1],
    });

    lynx.getCoreContext = coreContext;
  });
});
