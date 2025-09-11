// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { runRunOnMainThreadTask } from '../src/runOnMainThread';
import { initWorklet } from '../src/workletRuntime';

beforeEach(() => {
  globalThis.SystemInfo = {
    lynxSdkVersion: '2.16',
  };
  initWorklet();
  const dispatchEvent = vi.fn();
  globalThis.lynx = {
    getJSContext: vi.fn(() => ({
      dispatchEvent,
    })),
  };
});

afterEach(() => {
  delete globalThis.lynxWorkletImpl;
});

describe('runOnMainThread', () => {
  it('worklet should be called', () => {
    const fn = vi.fn(() => 'ret');
    globalThis.registerWorklet('main-thread', '1', fn);
    let worklet = {
      _wkltId: '1',
    };

    runRunOnMainThreadTask(worklet, [42], 10);
    expect(fn).toBeCalledWith(42);
    expect(globalThis.lynx.getJSContext().dispatchEvent.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "data": "{"resolveId":10,"returnValue":"ret"}",
            "type": "Lynx.Worklet.FunctionCallRet",
          },
        ],
      ]
    `);
  });
});
