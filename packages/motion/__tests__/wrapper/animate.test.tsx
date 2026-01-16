// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { runOnMainThread, useEffect } from '@lynx-js/react';
import { act, render } from '@lynx-js/react/testing-library';

import * as framerMotionDom from 'framer-motion/dom';
import * as motionDom from 'motion-dom';

import { animate, motionValue, stagger } from '../../src/animation/index.js';
import { ElementCompt } from '../../src/polyfill/element.js';

// Mock dependencies
vi.mock('framer-motion/dom', async (importOriginal) => {
  const actual = await importOriginal<typeof framerMotionDom>();
  return {
    ...actual,
    animate: (...args: any[]) => {
      (globalThis as any).__ANIMATE_ARGS = args;
      return { then: () => {}, play: () => {}, cancel: () => {} };
    },
    stagger: (...args: any[]) => {
      (globalThis as any).__STAGGER_ARGS = args;
      return (i: number) => i * 0.1;
    },
  };
});

vi.mock('motion-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof motionDom>();
  return {
    ...actual,
    motionValue: (...args: any[]) => {
      (globalThis as any).__MOTION_VALUE_ARGS = args;
      return { set: () => {}, get: () => 0 };
    },
  };
});

vi.mock('../../src/polyfill/element.js', async (importOriginal) => {
  return {
    ElementCompt: class ElementCompt {
      constructor(el: any) {
        (globalThis as any).__ELEMENT_COMPT_ARGS = el;
      }
    },
  };
});

describe('Wrapper Animation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Cleanup globals
    delete (globalThis as any).__ANIMATE_ARGS;
    delete (globalThis as any).__STAGGER_ARGS;
    delete (globalThis as any).__MOTION_VALUE_ARGS;
    delete (globalThis as any).__ELEMENT_COMPT_ARGS;
    delete (globalThis as any).__DEBUG_RES;
    delete (globalThis as any).__DEBUG_ERROR;
    delete (globalThis as any).__MOCK_QUERY_ARGS;

    // Mock lynx global with plain function
    const mockQuery = (...args: any[]) => {
      (globalThis as any).__MOCK_QUERY_ARGS = args;
      const sel = args.find(a => a === '#test-id');
      if (sel) return ['mockElement'];
      return [];
    };
    const mockLynx = {
      querySelectorAll: mockQuery,
    };

    (globalThis as any).lynx = mockLynx;
    // Mock internal globals
    (globalThis as any).__QuerySelectorAll = mockQuery;
    (globalThis as any).__GetPageElement = () => ({});
  });

  afterEach(() => {
    delete (globalThis as any).lynx;
    delete (globalThis as any).__QuerySelectorAll;
    delete (globalThis as any).__GetPageElement;
    delete (globalThis as any).__ANIMATE_ARGS;
    delete (globalThis as any).__STAGGER_ARGS;
    delete (globalThis as any).__MOTION_VALUE_ARGS;
    delete (globalThis as any).__ELEMENT_COMPT_ARGS;
    delete (globalThis as any).__DEBUG_RES;
    delete (globalThis as any).__DEBUG_ERROR;
    delete (globalThis as any).__MOCK_QUERY_ARGS;
  });

  describe('animate', () => {
    test('should delegate to framer-motion animate with string selector', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              // Debug check if lynx is available
              if (typeof lynx !== 'undefined') {
                const res = lynx.querySelectorAll('#test-id');
                (globalThis as any).__DEBUG_RES = res;
              } else {
                (globalThis as any).__DEBUG_RES = 'lynx undefined';
              }

              animate('#test-id', { opacity: 0 });
            } catch (e) {
              console.error(e);
              (globalThis as any).__DEBUG_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Verification from global state
      const animateArgs = (globalThis as any).__ANIMATE_ARGS;
      const debugRes = (globalThis as any).__DEBUG_RES;
      const debugErr = (globalThis as any).__DEBUG_ERROR;
      const mockQueryArgs = (globalThis as any).__MOCK_QUERY_ARGS;

      if (debugErr) {
        throw new Error('RunOnMainThread Error: ' + debugErr);
      }

      if (debugRes === 'lynx undefined') {
        throw new Error('lynx global is undefined in Main Thread');
      }

      if (debugRes) {
        expect(debugRes).toHaveLength(1);
        // Expect wrapped element
        expect(debugRes[0]).toEqual(
          expect.objectContaining({ element: 'mockElement' }),
        );
      }

      expect(animateArgs).toBeDefined();

      const comptArg = (globalThis as any).__ELEMENT_COMPT_ARGS;
      // Expect wrapped element here too
      expect(comptArg).toEqual(
        expect.objectContaining({ element: 'mockElement' }),
      );
    });

    test('should delegate to framer-motion animate with Element', async () => {
      const mockElement = { element: 'plain' } as any;
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              animate(mockElement, { opacity: 0 });
            } catch (e) {
              (globalThis as any).__DEBUG_ERROR_ELEMENT = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const debugErr = (globalThis as any).__DEBUG_ERROR_ELEMENT;
      if (debugErr) console.warn('Element Error:', debugErr);

      const animateArgs = (globalThis as any).__ANIMATE_ARGS;
      expect(animateArgs).toBeDefined();
      expect((globalThis as any).__ELEMENT_COMPT_ARGS).toEqual(mockElement);
    });

    test('should delegate to framer-motion animate with MotionValue', async () => {
      // ... same logic
      // omitted for brevity in thought but kept in file content above
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            const mv = { get: () => 0 };
            // @ts-ignore
            animate(mv, 100);
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect((globalThis as any).__ANIMATE_ARGS).toBeDefined();
      expect((globalThis as any).__ANIMATE_ARGS[1]).toBe(100);
    });
  });

  describe('stagger', () => {
    // ... same logic
    test('should delegate to framer-motion stagger', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            stagger(0.1);
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect((globalThis as any).__STAGGER_ARGS).toEqual([0.1]);
    });
  });

  describe('motionValue', () => {
    // ... same logic
    test('should delegate to motion-dom motionValue', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            motionValue(0);
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect((globalThis as any).__MOTION_VALUE_ARGS[0]).toBe(0);
    });

    test('should create motionValue with options', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            motionValue(100, { stopAnimation: () => {} });
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect((globalThis as any).__MOTION_VALUE_ARGS[0]).toBe(100);
    });
  });

  describe('spring', () => {
    test('should be exported', async () => {
      const { spring } = await import('../../src/animation/index.js');
      expect(spring).toBeDefined();
    });
  });

  describe('mix', () => {
    test('should interpolate between two numbers', async () => {
      const { mix } = await import('../../src/animation/index.js');

      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const result = mix(0, 100, 0.5);
              (globalThis as any).__MIX_RESULT = result;
            } catch (e) {
              (globalThis as any).__MIX_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect((globalThis as any).__MIX_RESULT).toBe(50);
      delete (globalThis as any).__MIX_RESULT;
      delete (globalThis as any).__MIX_ERROR;
    });

    test('should return mixer function when called with two args', async () => {
      const { mix } = await import('../../src/animation/index.js');

      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const mixer = mix(0, 100);
              (globalThis as any).__MIXER_TYPE = typeof mixer;
              if (typeof mixer === 'function') {
                (globalThis as any).__MIXER_RESULT = mixer(0.25);
              }
            } catch (e) {
              (globalThis as any).__MIXER_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect((globalThis as any).__MIXER_TYPE).toBe('function');
      expect((globalThis as any).__MIXER_RESULT).toBe(25);
      delete (globalThis as any).__MIXER_TYPE;
      delete (globalThis as any).__MIXER_RESULT;
      delete (globalThis as any).__MIXER_ERROR;
    });
  });

  describe('progress', () => {
    test('should calculate progress between two values', async () => {
      const { progress } = await import('../../src/animation/index.js');

      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const result = progress(0, 100, 50);
              (globalThis as any).__PROGRESS_RESULT = result;
            } catch (e) {
              (globalThis as any).__PROGRESS_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect((globalThis as any).__PROGRESS_RESULT).toBe(0.5);
      delete (globalThis as any).__PROGRESS_RESULT;
      delete (globalThis as any).__PROGRESS_ERROR;
    });
  });

  describe('clamp', () => {
    test('should clamp value within range', async () => {
      const { clamp } = await import('../../src/animation/index.js');

      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const within = clamp(0, 100, 50);
              const below = clamp(0, 100, -10);
              const above = clamp(0, 100, 150);
              (globalThis as any).__CLAMP_RESULTS = { within, below, above };
            } catch (e) {
              (globalThis as any).__CLAMP_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const results = (globalThis as any).__CLAMP_RESULTS;
      expect(results.within).toBe(50);
      expect(results.below).toBe(0);
      expect(results.above).toBe(100);
      delete (globalThis as any).__CLAMP_RESULTS;
      delete (globalThis as any).__CLAMP_ERROR;
    });
  });

  describe('styleEffect', () => {
    test('should be exported', async () => {
      const { styleEffect } = await import('../../src/animation/index.js');
      expect(styleEffect).toBeDefined();
    });
  });

  describe('Array of elements', () => {
    test('should animate array of elements', async () => {
      const App = () => {
        useEffect(() => {
          runOnMainThread(() => {
            'main thread';
            try {
              const elements = [{ element: 'el1' }, { element: 'el2' }] as any;
              animate(elements, { opacity: 1 });
              (globalThis as any).__ARRAY_ANIMATE_CALLED = true;
            } catch (e) {
              (globalThis as any).__ARRAY_ERROR = String(e);
            }
          })();
        }, []);
        return <view />;
      };
      render(<App />, { enableMainThread: true, enableBackgroundThread: true });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect((globalThis as any).__ARRAY_ANIMATE_CALLED).toBe(true);
      expect((globalThis as any).__ANIMATE_ARGS).toBeDefined();
      delete (globalThis as any).__ARRAY_ANIMATE_CALLED;
      delete (globalThis as any).__ARRAY_ERROR;
    });
  });
});
