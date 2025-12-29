// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { runOnMainThread, useMainThreadRef } from '@lynx-js/react';
import { jsx as _jsx } from '@lynx-js/react/jsx-runtime';
import { act, render } from '@lynx-js/react/testing-library';

import { animate } from '../src/index.js';
import { noop } from '../src/utils/noop.js';

describe('motion wrapping animation functions', () => {
  let _mockRegisterCallable;
  beforeEach(() => {
    const mockRegisteredMap = new Map();
    vi.spyOn(globalThis, 'runOnRegistered', 'get').mockImplementation(
      function(id) {
        const func = mockRegisteredMap.get(id) ?? noop;
        return func;
      },
    );
    function mockRegisterCallable(func, id) {
      mockRegisteredMap.set(id, func);
      return func;
    }
    _mockRegisterCallable = mockRegisterCallable;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  test('motion animate should be called', async () => {
    let _startAnimation;
    const _mockAnimate = _mockRegisterCallable(vi.fn(), 'animate');
    const App = () => {
      const boxMTRef = useMainThreadRef(null);
      console.log('renderApp');
      function startAnimation() {
        'main thread';
        if (boxMTRef.current) {
          animate(boxMTRef.current, { scale: 0.4, rotate: '45deg' }, {
            ease: 'circInOut',
            duration: 1,
            repeat: Number.POSITIVE_INFINITY,
            repeatType: 'reverse',
          });
        }
      }
      _startAnimation = startAnimation;
      return (_jsx('view', {
        children: _jsx('view', { 'main-thread:ref': boxMTRef }),
      }));
    };
    await act(() => {
      render(_jsx(App, {}), {
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
// # sourceMappingURL=animation.test.js.map
