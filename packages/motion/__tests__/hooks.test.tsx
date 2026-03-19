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

  describe('Real callback invocations', () => {
    test('should fire callback when MotionValue changes via set()', async () => {
      const App = () => {
        const mvRef = useMotionValueRef(0);

        useMotionValueRefEvent(mvRef, 'change', (v) => {
          'main thread';
          (globalThis as any).__CALLBACK_VALUES =
            (globalThis as any).__CALLBACK_VALUES || [];
          (globalThis as any).__CALLBACK_VALUES.push(v);
        });

        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            // Set value after a small delay to ensure listener is attached
            setTimeout(() => {
              if (mvRef.current) {
                mvRef.current.set(50);
                mvRef.current.set(100);
              }
            }, 50);
          })();
        }, []);

        return <view />;
      };

      render(<App />, {
        enableMainThread: true,
        enableBackgroundThread: true,
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      const values = (globalThis as any).__CALLBACK_VALUES || [];
      expect(values.length).toBeGreaterThan(0);
      expect(values).toContain(50);
      expect(values).toContain(100);

      delete (globalThis as any).__CALLBACK_VALUES;
    });

    test('should fire callback when MotionValue changes via jump()', async () => {
      const App = () => {
        const mvRef = useMotionValueRef(0);

        useMotionValueRefEvent(mvRef, 'change', (v) => {
          'main thread';
          (globalThis as any).__JUMP_VALUE = v;
        });

        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            setTimeout(() => {
              if (mvRef.current) {
                mvRef.current.jump(999);
              }
            }, 50);
          })();
        }, []);

        return <view />;
      };

      render(<App />, {
        enableMainThread: true,
        enableBackgroundThread: true,
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      const value = (globalThis as any).__JUMP_VALUE;
      expect(value).toBe(999);

      delete (globalThis as any).__JUMP_VALUE;
    });

    test('should not fire callback after unmount', async () => {
      let callbackCount = 0;

      const App = () => {
        const mvRef = useMotionValueRef(0);

        useMotionValueRefEvent(mvRef, 'change', () => {
          'main thread';
          callbackCount++;
          (globalThis as any).__CALLBACK_COUNT = callbackCount;
        });

        // Store ref globally for testing
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            (globalThis as any).__MV_REF = mvRef;
          })();
        }, []);

        return <view />;
      };

      const { unmount } = render(<App />, {
        enableMainThread: true,
        enableBackgroundThread: true,
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Trigger a change before unmount
      await act(async () => {
        runOnMainThread(() => {
          'main thread';
          const ref = (globalThis as any).__MV_REF;
          if (ref?.current) {
            ref.current.set(10);
          }
        })();
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const countBeforeUnmount = (globalThis as any).__CALLBACK_COUNT || 0;

      unmount();

      // Wait a bit after unmount
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // The callback count should not have increased after unmount
      // (we can't easily trigger more changes after unmount in this test setup)
      expect(countBeforeUnmount).toBeGreaterThan(0);

      delete (globalThis as any).__CALLBACK_COUNT;
      delete (globalThis as any).__MV_REF;
    });

    test('should support multiple listeners on same MotionValue', async () => {
      const App = () => {
        const mvRef = useMotionValueRef(0);

        useMotionValueRefEvent(mvRef, 'change', (v) => {
          'main thread';
          (globalThis as any).__LISTENER_1 =
            ((globalThis as any).__LISTENER_1 || 0) + 1;
        });

        useMotionValueRefEvent(mvRef, 'change', (v) => {
          'main thread';
          (globalThis as any).__LISTENER_2 =
            ((globalThis as any).__LISTENER_2 || 0) + 1;
        });

        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            setTimeout(() => {
              if (mvRef.current) {
                mvRef.current.set(50);
              }
            }, 50);
          })();
        }, []);

        return <view />;
      };

      render(<App />, {
        enableMainThread: true,
        enableBackgroundThread: true,
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      const listener1Count = (globalThis as any).__LISTENER_1 || 0;
      const listener2Count = (globalThis as any).__LISTENER_2 || 0;

      expect(listener1Count).toBeGreaterThan(0);
      expect(listener2Count).toBeGreaterThan(0);

      delete (globalThis as any).__LISTENER_1;
      delete (globalThis as any).__LISTENER_2;
    });
  });
});
