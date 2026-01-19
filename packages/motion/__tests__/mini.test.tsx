// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { runOnMainThread, useEffect, useMainThreadRef } from '@lynx-js/react';
import { act, render } from '@lynx-js/react/testing-library';

import { animate, createMotionValue } from '../src/mini/index.js';
import { noopMT } from '../src/utils/noop.js';

describe('motion mini', () => {
  let _mockRegisterCallable;
  let mockRegisteredMap: Map<string, CallableFunction>;

  beforeEach(() => {
    mockRegisteredMap = new Map<string, CallableFunction>();
    vi.spyOn(globalThis, 'runOnRegistered', 'get').mockImplementation(function(
      id: string,
    ) {
      const func = mockRegisteredMap.get(id) ?? noopMT;
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

  test('createMotionValue should work', async () => {
    const App = () => {
      useMainThreadRef(null);
      return <view />;
    };

    render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });
  });

  test('animate should update value', async () => {
    const App = () => {
      useEffect(() => {
        runOnMainThread(() => {
          'main thread';
          const mv = createMotionValue(0);

          const onUpdate = (v: number) => {
            'main thread';
          };
          const onComplete = () => {
            'main thread';
          };

          animate(mv, 100, {
            duration: 0.1,
            onUpdate,
            onComplete,
            ease: (t) => t, // Explicit ease
          });

          if (mv.get() !== 0) throw new Error('initial animate value wrong');
        })();
      }, []);
      return <view />;
    };

    render(<App />, {
      enableMainThread: true,
      enableBackgroundThread: true,
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });
});
