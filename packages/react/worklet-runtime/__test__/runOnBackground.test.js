// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initWorklet } from '../src/workletRuntime';

beforeEach(() => {
  globalThis.SystemInfo = {
    lynxSdkVersion: '2.16',
  };
  initWorklet();
});

afterEach(() => {
  delete globalThis.lynxWorkletImpl;
});

describe('runOnBackground', () => {
  it('should delay and run task', () => {
    const firstScreenWorklet = {
      _wkltId: 'ctx1',
      _jsFn: {
        '_jsFn1': { '_isFirstScreen': true },
        '_jsFn2': { '_isFirstScreen': true },
      },
    };
    const worklet = {
      _wkltId: 'ctx1',
      _jsFn: { '_jsFn1': { '_jsFnId': 1 }, '_jsFn2': { '_jsFnId': 2 }, '_jsFn3': { '_jsFnId': 3 } },
      _execId: 8,
    };
    // If the functions are not used in the first screen, they will not be hydrated
    globalThis.lynxWorkletImpl._hydrateCtx(worklet, firstScreenWorklet);
    expect(globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayedBackgroundFunctionArray.length).toBe(0);

    // If the functions are used in the first screen, they will be hydrated
    const task = vi.fn();
    globalThis.registerWorklet('main-thread', 'ctx1', function() {
      const { _jsFn1 } = this._jsFn;
      globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayRunOnBackground(_jsFn1, task);
    });
    globalThis.runWorklet(firstScreenWorklet, []);
    expect(globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayedBackgroundFunctionArray).toMatchInlineSnapshot(`
      [
        {
          "task": [MockFunction spy],
        },
      ]
    `);
    globalThis.lynxWorkletImpl._hydrateCtx(worklet, firstScreenWorklet);
    expect(globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayedBackgroundFunctionArray).toMatchInlineSnapshot(`
      [
        {
          "jsFnHandle": {
            "_execId": 8,
            "_jsFnId": 1,
          },
          "task": [MockFunction spy],
        },
      ]
    `);

    globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.runDelayedBackgroundFunctions();
    expect(task.mock.calls).toMatchInlineSnapshot(`
      [
        [
          1,
          8,
        ],
      ]
    `);
    expect(globalThis.lynxWorkletImpl._runOnBackgroundDelayImpl.delayedBackgroundFunctionArray.length).toBe(0);
  });
});
