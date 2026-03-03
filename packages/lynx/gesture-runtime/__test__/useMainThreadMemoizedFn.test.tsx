// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useState } from '@lynx-js/react';
import { act, render } from '@lynx-js/react/testing-library';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { useMainThreadMemoizedFn } from '../src/utils/useMainThreadMemoizedFn.js';

describe('useMainThreadMemoizedFn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should return a stable reference but execute the latest logic on background thread', async () => {
    let memoizedFnRef: any;
    let _setCount: any;

    const App = () => {
      const [count, setCount] = useState(0);
      _setCount = setCount;

      const memoizedFn = useMainThreadMemoizedFn(() => {
        'main thread';
        return count;
      });

      memoizedFnRef = memoizedFn;

      return <view></view>;
    };

    render(<App />);

    const fn1 = memoizedFnRef;
    let res = globalThis.runWorklet(fn1, []);
    expect(res).toBe(0);

    await act(() => {
      _setCount(1);
    });

    const fn2 = memoizedFnRef;
    expect(fn1).toBe(fn2); // Stable reference!

    res = globalThis.runWorklet(fn2, []);
    expect(res).toBe(1); // Latest logic!
  });

  test('should return a stable reference but execute the latest logic on main thread', async () => {
    let memoizedFnRef: any;
    let _setCount: any;

    const App = () => {
      const [count, setCount] = useState(0);
      _setCount = setCount;

      const memoizedFn = useMainThreadMemoizedFn(() => {
        'main thread';
        return count;
      });

      memoizedFnRef = memoizedFn;

      return <view></view>;
    };

    await act(() => {
      render(<App />, {
        enableMainThread: true,
        enableBackgroundThread: true,
      });
    });

    const fn1 = memoizedFnRef;
    let res = globalThis.runWorklet(fn1, []);
    expect(res).toBe(0);

    await act(() => {
      _setCount(1);
    });

    const fn2 = memoizedFnRef;
    expect(fn1).toBe(fn2); // Stable reference!

    res = globalThis.runWorklet(fn2, []);
    expect(res).toBe(1); // Latest logic!
  });

  test('should pass arguments properly and return value', () => {
    let memoizedFnRef: any;

    const App = () => {
      const memoizedFn = useMainThreadMemoizedFn((a: number, b: number) => {
        'main thread';
        return a + b;
      });

      memoizedFnRef = memoizedFn;

      return <view></view>;
    };

    render(<App />);

    expect(globalThis.runWorklet(memoizedFnRef, [2, 3])).toBe(5);
  });
});
