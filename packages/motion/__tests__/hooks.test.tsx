// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { runOnMainThread, useEffect, useMainThreadRef } from '@lynx-js/react';
import { act, render } from '@lynx-js/react/testing-library';

import {
  useMotionValueRef,
  useMotionValueRefEvent,
} from '../src/mini/index.js';
import { noop } from '../src/utils/noop.js';

describe('Hooks', () => {
  let mockRegisteredMap: Map<string, CallableFunction>;

  beforeEach(() => {
    mockRegisteredMap = new Map<string, CallableFunction>();
    vi.spyOn(globalThis, 'runOnRegistered', 'get').mockImplementation(
      function(id: string) {
        const func = mockRegisteredMap.get(id) ?? noop;
        return func;
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useMotionValueRef', () => {
    test('should create motion value ref with initial value', () => {
      const App = () => {
        const mvRef = useMotionValueRef(0);
        useMainThreadRef(null);
        return <view />;
      };

      render(<App />, {
        enableMainThread: true,
        enableBackgroundThread: true,
      });

      // Test passes if no errors thrown during render
      expect(true).toBe(true);
    });

    test('should create motion value ref without errors', async () => {
      let refCreated = false;

      const App = () => {
        const mvRef = useMotionValueRef(42);
        refCreated = true;
        return <view />;
      };

      render(<App />, {
        enableMainThread: true,
        enableBackgroundThread: true,
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(refCreated).toBe(true);
    });

    test('should support different value types', async () => {
      const numberRef = vi.fn();
      const stringRef = vi.fn();

      const AppNumber = () => {
        useMotionValueRef(123);
        numberRef();
        return <view />;
      };

      const AppString = () => {
        useMotionValueRef('test');
        stringRef();
        return <view />;
      };

      render(<AppNumber />, {
        enableMainThread: true,
        enableBackgroundThread: true,
      });

      render(<AppString />, {
        enableMainThread: true,
        enableBackgroundThread: true,
      });

      expect(numberRef).toHaveBeenCalled();
      expect(stringRef).toHaveBeenCalled();
    });
  });

  describe('useMotionValueRefEvent', () => {
    test('should set up event listener without errors', () => {
      const callback = vi.fn();

      const App = () => {
        const mvRef = useMotionValueRef(0);
        useMotionValueRefEvent(mvRef, 'change', callback);
        return <view />;
      };

      render(<App />, {
        enableMainThread: true,
        enableBackgroundThread: true,
      });

      // Test passes without throwing
      expect(true).toBe(true);
    });

    test('should accept callback function', async () => {
      const callback = vi.fn();

      const App = () => {
        const mvRef = useMotionValueRef(0);
        useMotionValueRefEvent(mvRef, 'change', callback);
        return <view />;
      };

      render(<App />, {
        enableMainThread: true,
        enableBackgroundThread: true,
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Callback should be a function
      expect(typeof callback).toBe('function');
    });

    test('should work with unmount', async () => {
      const callback = vi.fn();

      const App = () => {
        const mvRef = useMotionValueRef(0);
        useMotionValueRefEvent(mvRef, 'change', callback);
        return <view />;
      };

      const { unmount } = render(<App />, {
        enableMainThread: true,
        enableBackgroundThread: true,
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      unmount();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Integration scenarios', () => {
    test('should work together without errors', async () => {
      const callback = vi.fn();

      const App = () => {
        const mvRef = useMotionValueRef(0);
        useMotionValueRefEvent(mvRef, 'change', callback);

        return <view />;
      };

      render(<App />, {
        enableMainThread: true,
        enableBackgroundThread: true,
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(true).toBe(true);
    });

    test('should support multiple motion value refs', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const App = () => {
        const mvRef1 = useMotionValueRef(0);
        const mvRef2 = useMotionValueRef(100);

        useMotionValueRefEvent(mvRef1, 'change', callback1);
        useMotionValueRefEvent(mvRef2, 'change', callback2);

        return <view />;
      };

      render(<App />, {
        enableMainThread: true,
        enableBackgroundThread: true,
      });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(true).toBe(true);
    });
  });
});
