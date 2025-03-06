// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { onPostWorkletCtx } from '../../src/worklet/ctx';
import { destroyWorklet } from '../../src/worklet/destroy';
import { clearConfigCacheForTesting } from '../../src/worklet/functionality';
import { runOnBackground } from '../../src/worklet/runOnBackground';
import { globalEnvManager } from '../utils/envManager';

beforeEach(() => {
  SystemInfo.lynxSdkVersion = '999.999';
  clearConfigCacheForTesting();
});

afterEach(() => {
  destroyWorklet();
  vi.clearAllMocks();
});

describe('runOnBackground', () => {
  it('should trigger event', () => {
    globalEnvManager.switchToMainThread();
    const jsFn = {
      _jsFnId: 233,
      _execId: 244,
    };
    runOnBackground(jsFn)(1, ['args']);
    expect(lynx.getJSContext().dispatchEvent.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "data": "{"obj":{"_jsFnId":233,"_execId":244},"params":[1,["args"]]}",
            "type": "Lynx.Worklet.runOnBackground",
          },
        ],
      ]
    `);
  });

  it('should throw when on the main thread', () => {
    globalEnvManager.switchToBackground();
    const worklet = {
      _wkltId: '835d:450ef:2',
    };
    expect(() => {
      runOnBackground(worklet)(1, ['args']);
    }).toThrowError('runOnBackground can only be used on the main thread.');
  });

  it('should throw when native capabilities not fulfilled', () => {
    clearConfigCacheForTesting();
    globalEnvManager.switchToMainThread();
    SystemInfo.lynxSdkVersion = '2.15';
    const worklet = {
      _wkltId: '835d:450ef:2',
    };
    expect(() => {
      runOnBackground(worklet)(1, ['args']);
    }).toThrowError('runOnBackground requires Lynx sdk version 2.16.');
    clearConfigCacheForTesting();
  });

  it('should throw when _error exists', () => {
    globalEnvManager.switchToMainThread();
    const jsFn = {
      _jsFnId: 233,
      _error: 'error occurred',
    };
    expect(() => {
      runOnBackground(jsFn)(1, ['args']);
    }).toThrowError('error occurred');
  });
});

describe('EventListeners', () => {
  it('should get impl and destroy', () => {
    expect(lynx.getCoreContext().addEventListener).toHaveBeenCalledTimes(0);
    onPostWorkletCtx({});
    expect(lynx.getCoreContext().addEventListener).toHaveBeenCalledTimes(2);
    onPostWorkletCtx({});
    expect(lynx.getCoreContext().addEventListener).toHaveBeenCalledTimes(2);
    expect(lynx.getCoreContext().removeEventListener).toHaveBeenCalledTimes(0);
    destroyWorklet();
    expect(lynx.getCoreContext().removeEventListener).toHaveBeenCalledTimes(2);
    onPostWorkletCtx({});
    expect(lynx.getCoreContext().addEventListener).toHaveBeenCalledTimes(4);
  });

  it('should not listen when not enableRunOnBackground', () => {
    SystemInfo.lynxSdkVersion = '2.15';
    onPostWorkletCtx({});
    expect(lynx.getCoreContext().addEventListener).toHaveBeenCalledTimes(0);
    onPostWorkletCtx({});
    expect(lynx.getCoreContext().addEventListener).toHaveBeenCalledTimes(0);
    destroyWorklet();
    expect(lynx.getCoreContext().removeEventListener).toHaveBeenCalledTimes(0);
  });

  it('should not listen when not enableRunOnBackground 2', () => {
    SystemInfo.lynxSdkVersion = undefined;
    onPostWorkletCtx({});
    expect(lynx.getCoreContext().addEventListener).toHaveBeenCalledTimes(0);
    onPostWorkletCtx({});
    expect(lynx.getCoreContext().addEventListener).toHaveBeenCalledTimes(0);
    destroyWorklet();
    expect(lynx.getCoreContext().removeEventListener).toHaveBeenCalledTimes(0);
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
    const id = onPostWorkletCtx(worklet)._execId;
    const trigger = () => {
      lynx.getCoreContext().dispatchEvent({
        type: 'Lynx.Worklet.runOnBackground',
        data: JSON.stringify({
          obj: {
            _jsFnId: 233,
            _execId: id,
          },
          params: ['hello'],
        }),
      });
    };

    trigger();
    expect(fn).toBeCalledWith('hello');

    lynx.getCoreContext().dispatchEvent({
      type: 'Lynx.Worklet.releaseBackgroundWorkletCtx',
      data: [id],
    });

    expect(trigger).toThrow('runOnBackground: JS function not found: {"_jsFnId":233,"_execId":1}');
  });
});
