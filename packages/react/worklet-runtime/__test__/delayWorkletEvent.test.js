// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';

import { clearDelayedWorklets, delayExecUntilJsReady, runDelayedWorklet } from '../src/delayWorkletEvent';
import { updateWorkletRefInitValueChanges } from '../src/workletRef';
import { initWorklet } from '../src/workletRuntime';

beforeEach(() => {
  globalThis.SystemInfo = {
    lynxSdkVersion: '2.16',
  };
  initWorklet();
  rs.useFakeTimers();
});

afterEach(() => {
  delete globalThis.lynxWorkletImpl;
  rs.useRealTimers();
});

describe('DelayWorkletEvent', () => {
  it('should delay', () => {
    const fn = rs.fn(function() {
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
    delayExecUntilJsReady('1', [event, 1]);
    globalThis.runWorklet({
      _lepusWorkletHash: '1',
    }, [event, 2]);
    delayExecUntilJsReady('1', [event2, 3]);

    let worklet = {
      _c: {
        wv: {
          _wvid: 178,
        },
      },
      _wkltId: '1',
    };

    updateWorkletRefInitValueChanges([[178, 333]]);
    runDelayedWorklet(worklet, 'element');
    rs.runAllTimers();
    expect(fn).toBeCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, expect.anything(), 1);
    expect(fn).toHaveBeenNthCalledWith(2, expect.anything(), 2);
  });

  it('should clear delayed worklets', () => {
    const fn = rs.fn();
    globalThis.registerWorklet('main-thread', '1', fn);

    const event = {
      currentTarget: {
        elementRefptr: 'element',
      },
    };
    delayExecUntilJsReady('1', [event]);

    clearDelayedWorklets();

    let worklet = {
      _wkltId: '1',
    };

    runDelayedWorklet(worklet, 'element');
    rs.runAllTimers();
    expect(fn).not.toBeCalled();
  });
});
