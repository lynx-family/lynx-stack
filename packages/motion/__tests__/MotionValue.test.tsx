// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { runOnMainThread, useEffect } from '@lynx-js/react';
import { act, render } from '@lynx-js/react/testing-library';

import { createMotionValue } from '../src/mini/core/MotionValue.js';

describe('MotionValue', () => {
  let mockRegisteredMap: Map<string, CallableFunction>;

  beforeEach(() => {
    mockRegisteredMap = new Map<string, CallableFunction>();
    const mockImpl = (id: string) => {
      const func = mockRegisteredMap.get(id);
      if (func) return func;
      return () => {};
    };
    Object.defineProperty(globalThis, 'runOnRegistered', {
      get: () => mockImpl,
      configurable: true,
    });
    (globalThis as any).__TEST_ERROR = undefined;
    (globalThis as any).__MV = undefined; // Clear persistent motion value
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers(); // Ensure timers are reset
    delete (globalThis as any).runOnRegistered;
    delete (globalThis as any).__TEST_ERROR;
    delete (globalThis as any).__MV;
  });

  const checkError = async () => {
    await act(async () => {
      await Promise.resolve(); // Just flush, don't use setTimeout directly if timers fake
    });
    const err = (globalThis as any).__TEST_ERROR;
    if (err) throw new Error(err);
  };

  describe('createMotionValue', () => {
    test('should create motion value with initial number value', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mv = createMotionValue(0);
              if (mv.get() !== 0) {
                throw new Error(`Expected 0 but got ${mv.get()}`);
              }
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();
    });

    test('should create motion value with initial string value', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mv = createMotionValue('hello');
              if (mv.get() !== 'hello') throw new Error(`Expected hello`);
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();
    });
  });

  describe('get() and set()', () => {
    test('should get and set number values', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mv = createMotionValue(0);
              mv.set(100);
              if (mv.get() !== 100) throw new Error('Set fail');
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();
    });

    test('should trigger listeners on set', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mv = createMotionValue(0);
              let called = 0;
              const listener = () => called++;
              mv.onChange(listener);
              mv.set(50);
              if (called !== 1) throw new Error('Listener not called');
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();
    });
  });

  describe('velocity tracking', () => {
    test('should track velocity on number value changes', async () => {
      vi.useFakeTimers();

      const App = () => {
        useEffect(() => {
          // Step 1: Init
          runOnMainThread(() => {
            'main thread';
            try {
              const mv = createMotionValue(0);
              mv.set(0);
              (globalThis as any).__MV = mv;
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      const { rerender } = render(<App />, {
        enableMainThread: true,
        enableBackgroundThread: true,
      });

      // Manually handle waiting logic since timers are mocked
      await act(async () => {
        vi.advanceTimersByTime(10);
      });
      await checkError();

      // Step 2: Advance time
      await act(async () => {
        // We already advanced 10ms for previous check.
        // We want total 100ms interval for easy math.
        vi.advanceTimersByTime(90);
      });

      // Step 3: Set value
      const Step2 = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mv = (globalThis as any).__MV;
              mv.set(10);
              // Check velocity
              const v = mv.getVelocity();
              // 10 / 0.1 = 100
              if (Math.abs(v - 100) > 1) {
                throw new Error('Velocity mismatch: ' + v);
              }
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      rerender(<Step2 />);

      await act(async () => {
        vi.advanceTimersByTime(10);
      });
      await checkError();
    });
  });

  describe('jump()', () => {
    test('should set value without triggering velocity calculation', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mv = createMotionValue(0);
              mv.jump(100);
              if (mv.get() !== 100) throw new Error('Jump val fail');
              if (mv.getVelocity() !== 0) {
                throw new Error('Jump velocity not 0');
              }
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();
    });
  });

  describe('onChange() and on()', () => {
    test('should subscribe and unsubscribe', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mv = createMotionValue(0);
              let count = 0;
              const listener = () => count++;
              const unsub = mv.onChange(listener);

              mv.set(10);
              if (count !== 1) throw new Error('Count 1 fail');

              unsub();
              mv.set(20);
              if (count !== 1) throw new Error('Unsub fail');
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();
    });
  });

  describe('attach() and stop()', () => {
    test('should attach and lifecycle', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mv = createMotionValue(0);
              let cancelled = false;
              const cancel = () => cancelled = true;

              mv.attach(cancel);
              if (!mv.isAnimating()) {
                throw new Error('Should match isAnimating true');
              }

              mv.stop();
              if (!cancelled) throw new Error('Cancel func not called');
              if (mv.isAnimating()) {
                throw new Error('Should match isAnimating false');
              }
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();
    });
  });

  describe('clearListeners()', () => {
    test('should remove all listeners', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mv = createMotionValue(0);
              let count = 0;
              mv.onChange(() => count++);

              mv.set(10);
              if (count !== 1) throw new Error('Init count fail');

              mv.clearListeners();
              mv.set(20);
              if (count !== 1) {
                throw new Error('Clear listeners fail (still called)');
              }
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();
    });
  });

  describe('destroy()', () => {
    test('should stop all animations and clear all listeners', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mv = createMotionValue(0);
              let cancelled = false;
              let count = 0;

              mv.attach(() => cancelled = true);
              mv.onChange(() => count++);

              mv.destroy();

              if (!cancelled) {
                throw new Error('Destroy did not cancel animation');
              }
              if (mv.isAnimating()) {
                throw new Error('Still animating after destroy');
              }

              mv.set(10);
              if (count !== 0) throw new Error('Listener called after destroy');
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();
    });
  });

  describe('Edge cases', () => {
    test('multiple listeners should all receive callbacks', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mv = createMotionValue(0);
              let count1 = 0;
              let count2 = 0;
              let count3 = 0;

              mv.onChange(() => count1++);
              mv.onChange(() => count2++);
              mv.on('change', () => count3++);

              mv.set(10);
              mv.set(20);

              if (count1 !== 2) throw new Error(`Listener1 fail: ${count1}`);
              if (count2 !== 2) throw new Error(`Listener2 fail: ${count2}`);
              if (count3 !== 2) throw new Error(`Listener3 fail: ${count3}`);
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();
    });

    test('on() with unsupported event should return noop-like function', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mv = createMotionValue(0);

              // Calling on() with an unsupported event should throw
              // @ts-expect-error - testing unsupported event
              mv.on('unsupported', () => {});
            } catch (e: any) {
              if (
                e.message
                  === 'mini animate() does not support event type other than \'change\''
              ) {
                // Expected error
                return;
              }
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();
    });

    test('toJSON() should serialize value correctly', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mvNumber = createMotionValue(42);
              const mvString = createMotionValue('hello');

              const json1 = mvNumber.toJSON();
              const json2 = mvString.toJSON();

              if (json1 !== '42') {
                throw new Error(`Number toJSON fail: ${json1}`);
              }
              if (json2 !== 'hello') {
                throw new Error(`String toJSON fail: ${json2}`);
              }
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();
    });

    test('unsubscribe should only remove specific listener', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mv = createMotionValue(0);
              let count1 = 0;
              let count2 = 0;

              const unsub1 = mv.onChange(() => count1++);
              mv.onChange(() => count2++);

              mv.set(10); // Both should fire
              unsub1(); // Unsubscribe first
              mv.set(20); // Only second should fire

              if (count1 !== 1) throw new Error(`Listener1 fail: ${count1}`);
              if (count2 !== 2) throw new Error(`Listener2 fail: ${count2}`);
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();
    });

    test('multiple attach() calls should track all animations', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mv = createMotionValue(0);
              let cancel1Called = false;
              let cancel2Called = false;

              mv.attach(() => {
                cancel1Called = true;
              });
              mv.attach(() => {
                cancel2Called = true;
              });

              if (!mv.isAnimating()) {
                throw new Error('Should be animating');
              }

              mv.stop();

              if (!cancel1Called) throw new Error('Cancel1 not called');
              if (!cancel2Called) throw new Error('Cancel2 not called');
              if (mv.isAnimating()) {
                throw new Error('Should not be animating after stop');
              }
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();
    });
  });
});
