// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { runOnMainThread, useEffect } from '@lynx-js/react';
import { act, render } from '@lynx-js/react/testing-library';

import { animate, createMotionValue } from '../src/mini/index.js';

describe('animate()', () => {
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).runOnRegistered;
    delete (globalThis as any).__TEST_ERROR;
  });

  const checkError = async () => {
    await act(async () => {
      await Promise.resolve();
    });
    const err = (globalThis as any).__TEST_ERROR;
    if (err) throw new Error(err);
  };

  describe('animate with MotionValue', () => {
    test('should animate MotionValue and call onComplete when finished', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mv = createMotionValue(0);
              let completed = false;

              animate(mv, 100, {
                duration: 0.05, // 50ms - very short animation
                ease: (t) => t,
                onComplete: () => {
                  completed = true;
                  (globalThis as any).__COMPLETED = true;
                },
              });

              (globalThis as any).__MV = mv;
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };

      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();

      // Wait for animation to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      const completed = (globalThis as any).__COMPLETED;
      expect(completed).toBe(true);

      delete (globalThis as any).__COMPLETED;
      delete (globalThis as any).__MV;
    });

    test('should call onUpdate during animation', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mv = createMotionValue(0);
              let updateCount = 0;

              animate(mv, 100, {
                duration: 0.05,
                ease: (t) => t,
                onUpdate: () => {
                  updateCount++;
                  (globalThis as any).__UPDATE_COUNT = updateCount;
                },
              });
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };

      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      const updateCount = (globalThis as any).__UPDATE_COUNT ?? 0;
      expect(updateCount).toBeGreaterThan(0);

      delete (globalThis as any).__UPDATE_COUNT;
    });

    test('should stop animation when stop() is called', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mv = createMotionValue(0);
              let completed = false;

              const controls = animate(mv, 100, {
                duration: 0.2, // 200ms animation
                ease: (t) => t,
                onComplete: () => {
                  completed = true;
                  (globalThis as any).__COMPLETED = true;
                },
              });

              // Stop after 50ms
              setTimeout(() => {
                controls.stop();
                (globalThis as any).__STOPPED = true;
              }, 50);
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };

      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();

      // Wait for animation to would-have-completed
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
      });

      const stopped = (globalThis as any).__STOPPED;
      const completed = (globalThis as any).__COMPLETED;

      expect(stopped).toBe(true);
      expect(completed).toBe(undefined); // Should NOT complete because it was stopped

      delete (globalThis as any).__STOPPED;
      delete (globalThis as any).__COMPLETED;
    });

    test('should support then() for promise-like callback', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mv = createMotionValue(0);

              const controls = animate(mv, 100, {
                duration: 0.05,
                ease: (t) => t,
              });

              controls.then(() => {
                (globalThis as any).__THEN_CALLED = true;
              });
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };

      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      const thenCalled = (globalThis as any).__THEN_CALLED;
      expect(thenCalled).toBe(true);

      delete (globalThis as any).__THEN_CALLED;
    });
  });

  describe('animate with function setter', () => {
    test('should call function setter during animation', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const values: number[] = [];
              const setter = (v: number) => {
                'main thread';
                values.push(v);
                (globalThis as any).__VALUES = values;
              };

              animate(setter, 100, {
                duration: 0.05,
                from: 0,
                ease: (t) => t,
              });
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };

      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      const values = (globalThis as any).__VALUES || [];
      expect(values.length).toBeGreaterThan(0);
      // Last value should be target (100)
      expect(values[values.length - 1]).toBe(100);

      delete (globalThis as any).__VALUES;
    });
  });

  describe('animate with number value', () => {
    test('should animate from number value', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              animate(50, 100, {
                duration: 0.05,
                ease: (t) => t,
                onComplete: () => {
                  (globalThis as any).__COMPLETED = true;
                },
              });
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };

      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      const completed = (globalThis as any).__COMPLETED;
      expect(completed).toBe(true);

      delete (globalThis as any).__COMPLETED;
    });
  });

  describe('spring animation', () => {
    test('should use spring animation when type is spring', async () => {
      // Mock springHandle
      let springCalled = false;
      mockRegisteredMap.set('springHandle', (options: any) => {
        springCalled = true;
        // Return a mock generator that completes quickly
        let calls = 0;
        return {
          next: (t: number) => {
            calls++;
            return {
              value: calls > 5 ? 100 : 50,
              done: calls > 5,
            };
          },
        };
      });

      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mv = createMotionValue(0);

              animate(mv, 100, {
                type: 'spring',
                stiffness: 100,
                damping: 10,
              });

              (globalThis as any).__MV = mv;
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };

      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      expect(springCalled).toBe(true);

      delete (globalThis as any).__MV;
    });
  });

  describe('MotionValue integration', () => {
    test('should stop previous animation when starting new one', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mv = createMotionValue(0);

              animate(mv, 50, {
                duration: 0.3,
                ease: (t) => t,
                onComplete: () => {
                  (globalThis as any).__FIRST_COMPLETED = true;
                },
              });

              // Start second animation immediately - should stop first
              animate(mv, 100, {
                duration: 0.05,
                ease: (t) => t,
                onComplete: () => {
                  (globalThis as any).__SECOND_COMPLETED = true;
                },
              });
            } catch (e) {
              (globalThis as any).__TEST_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };

      render(<App />, { enableMainThread: true, enableBackgroundThread: true });
      await checkError();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      const firstCompleted = (globalThis as any).__FIRST_COMPLETED;
      const secondCompleted = (globalThis as any).__SECOND_COMPLETED;

      // First should NOT complete because it was stopped
      expect(firstCompleted).toBe(undefined);
      // Second should complete
      expect(secondCompleted).toBe(true);

      delete (globalThis as any).__FIRST_COMPLETED;
      delete (globalThis as any).__SECOND_COMPLETED;
    });
  });
});
