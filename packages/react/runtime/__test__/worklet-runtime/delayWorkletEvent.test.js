// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initEventDelay } from '../../src/worklet-runtime/delayWorkletEvent';
import { updateWorkletRefInitValueChanges } from '../../src/worklet-runtime/workletRef';
import { initWorklet } from '../../src/worklet-runtime/workletRuntime';

beforeEach(() => {
  globalThis.SystemInfo = {
    lynxSdkVersion: '2.16',
  };
  initWorklet();
  vi.useFakeTimers();
});

afterEach(() => {
  delete globalThis.lynxWorkletImpl;
  vi.useRealTimers();
});

describe('DelayWorkletEvent', () => {
  it('should delay', () => {
    const fn = vi.fn(function() {
      const { wv } = this._c;
      expect(wv.current).toBe(333);
    });
    globalThis.registerWorklet('main-thread', '1', fn);

    const event = {
      currentTarget: {
        elementRefptr: 'element',
      },
    };
    const event2 = {
      currentTarget: {
        elementRefptr: 'element2',
      },
    };
    globalThis.lynxWorkletImpl._eventDelayImpl.delayExecUntilJsReady('1', [event, 1]);
    globalThis.runWorklet({
      _lepusWorkletHash: '1',
    }, [event, 2]);
    globalThis.lynxWorkletImpl._eventDelayImpl.delayExecUntilJsReady('1', [event2, 3]);

    let worklet = {
      _c: {
        wv: {
          _wvid: 178,
        },
      },
      _wkltId: '1',
    };

    updateWorkletRefInitValueChanges([[178, 333]]);
    globalThis.lynxWorkletImpl._eventDelayImpl.runDelayedWorklet(worklet, 'element');
    vi.runAllTimers();
    expect(fn).toBeCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, expect.anything(), 1);
    expect(fn).toHaveBeenNthCalledWith(2, expect.anything(), 2);
  });

  it('should clear delayed worklets', () => {
    const fn = vi.fn();
    globalThis.registerWorklet('main-thread', '1', fn);

    const event = {
      currentTarget: {
        elementRefptr: 'element',
      },
    };
    globalThis.lynxWorkletImpl._eventDelayImpl.delayExecUntilJsReady('1', [event]);

    globalThis.lynxWorkletImpl._eventDelayImpl.clearDelayedWorklets();

    let worklet = {
      _wkltId: '1',
    };

    globalThis.lynxWorkletImpl._eventDelayImpl.runDelayedWorklet(worklet, 'element');
    vi.runAllTimers();
    expect(fn).not.toBeCalled();
  });

  it('keeps state isolated per EventDelayImpl instance', () => {
    const fn = vi.fn();
    globalThis.registerWorklet('main-thread', '1', fn);
    const first = initEventDelay();
    const second = initEventDelay();
    const event = { currentTarget: { elementRefptr: 'element' } };

    first.delayExecUntilJsReady('1', [event, 'first']);
    second.clearDelayedWorklets();

    first.runDelayedWorklet({ _wkltId: '1' }, 'element');
    vi.runAllTimers();
    expect(fn).toHaveBeenCalledExactlyOnceWith(expect.anything(), 'first');
  });
});
