// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { runOnMainThread, useEffect, useMainThreadRef } from '@lynx-js/react';
import { act, render } from '@lynx-js/react/testing-library';
import { MainThread } from '@lynx-js/types';

import { animate } from '../src/index.js';
import { noop } from '../src/utils/noop.js';

describe('motion wrapping animation functions', () => {
  let _mockRegisterCallable;
  beforeEach(() => {
    const mockRegisteredMap = new Map<string, CallableFunction>();
    vi.spyOn(globalThis, 'runOnRegistered', 'get').mockImplementation(function(
      id: string,
    ) {
      const func = mockRegisteredMap.get(id) ?? noop;
      return func;
    });

    function mockRegisterCallable(
      func: CallableFunction,
      id: string,
    ): CallableFunction {
      mockRegisteredMap.set(id, func);

      return func;
    }

    _mockRegisterCallable = mockRegisterCallable;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('motion animate should be called', async () => {
    let _startAnimation: () => void;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const _mockAnimate = _mockRegisterCallable(vi.fn(), 'animate');

    const App = () => {
      const boxMTRef = useMainThreadRef<MainThread.Element>(null);

      console.log('renderApp');

      function startAnimation() {
        'main thread';

        if (boxMTRef.current) {
          animate(
            boxMTRef.current,
            { scale: 0.4, rotate: '45deg' },
            {
              ease: 'circInOut',
              duration: 1,
              repeat: Number.POSITIVE_INFINITY,
              repeatType: 'reverse',
            },
          );
        }
      }

      _startAnimation = startAnimation;

      return (
        <view>
          <view main-thread:ref={boxMTRef}></view>
        </view>
      );
    };

    await act(() => {
      render(<App />, {
        enableMainThread: true,
        enableBackgroundThread: true,
      });
    });

    await runOnMainThread(() => {
      'main thread';
      _startAnimation();
    })();

    // Check that the mock was called
    expect(_mockAnimate).toHaveBeenCalled();

    // You can also check what arguments it received
    expect(_mockAnimate).toHaveBeenCalledWith(
      expect.anything(), // the element
      { scale: 0.4, rotate: '45deg' },
      {
        ease: 'circInOut',
        duration: 1,
        repeat: Number.POSITIVE_INFINITY,
        repeatType: 'reverse',
      },
    );
  });
});
