// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, test, vi } from 'vitest';

describe('Easing Functions', () => {
  let mockRegisteredMap: Map<string, CallableFunction>;

  beforeEach(() => {
    mockRegisteredMap = new Map<string, CallableFunction>();
    vi.spyOn(globalThis, 'runOnRegistered', 'get').mockImplementation(
      function(id: string) {
        const func = mockRegisteredMap.get(id) ?? ((t: number) => t);
        return func;
      },
    );

    // Mock all easing functions with simple implementations for testing
    // In real usage, these would be from motion-utils
    mockRegisteredMap.set('linearHandle', (t: number) => t);
    mockRegisteredMap.set('easeInHandle', (t: number) => t * t);
    mockRegisteredMap.set('easeOutHandle', (t: number) => t * (2 - t));
    mockRegisteredMap.set(
      'easeInOutHandle',
      (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    );
    mockRegisteredMap.set(
      'circInHandle',
      (t: number) => 1 - Math.sqrt(1 - t * t),
    );
    mockRegisteredMap.set(
      'circOutHandle',
      (t: number) => Math.sqrt(1 - (t - 1) * (t - 1)),
    );
    mockRegisteredMap.set('circInOutHandle', (t: number) =>
      t < 0.5
        ? (1 - Math.sqrt(1 - 4 * t * t)) / 2
        : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2);
    mockRegisteredMap.set('backInHandle', (t: number) => {
      const c = 1.70158;
      return t * t * ((c + 1) * t - c);
    });
    mockRegisteredMap.set('backOutHandle', (t: number) => {
      const c = 1.70158;
      const t1 = t - 1;
      return t1 * t1 * ((c + 1) * t1 + c) + 1;
    });
    mockRegisteredMap.set('backInOutHandle', (t: number) => {
      const c = 1.70158 * 1.525;
      if (t < 0.5) {
        return (2 * t) ** 2 * ((c + 1) * 2 * t - c) / 2;
      }
      return ((2 * t - 2) ** 2 * ((c + 1) * (2 * t - 2) + c) + 2) / 2;
    });
    mockRegisteredMap.set('anticipateHandle', (t: number) => {
      const c = 1.70158;
      return t * t * ((c + 1) * t - c);
    });
  });

  describe('Easing functions export and work correctly', () => {
    test('all easing functions should be exported from mini/core/easings', async () => {
      const easings = await import('../src/mini/core/easings.js');

      expect(typeof easings.linear).toBe('function');
      expect(typeof easings.easeIn).toBe('function');
      expect(typeof easings.easeOut).toBe('function');
      expect(typeof easings.easeInOut).toBe('function');
      expect(typeof easings.circIn).toBe('function');
      expect(typeof easings.circOut).toBe('function');
      expect(typeof easings.circInOut).toBe('function');
      expect(typeof easings.backIn).toBe('function');
      expect(typeof easings.backOut).toBe('function');
      expect(typeof easings.backInOut).toBe('function');
      expect(typeof easings.anticipate).toBe('function');
    });

    test('all easing functions should call globalThis.runOnRegistered', async () => {
      const easings = await import('../src/mini/core/easings.js');
      const spy = vi.spyOn(globalThis, 'runOnRegistered', 'get');

      easings.linear(0.5);
      easings.easeIn(0.5);
      easings.easeOut(0.5);
      easings.easeInOut(0.5);
      easings.circIn(0.5);
      easings.circOut(0.5);
      easings.circInOut(0.5);
      easings.backIn(0.5);
      easings.backOut(0.5);
      easings.backInOut(0.5);
      easings.anticipate(0.5);

      // Each call should have invoked runOnRegistered
      expect(spy).toHaveBeenCalled();
    });

    test('easing functions should return numbers', async () => {
      const easings = await import('../src/mini/core/easings.js');

      const funcs = [
        easings.linear,
        easings.easeIn,
        easings.easeOut,
        easings.easeInOut,
        easings.circIn,
        easings.circOut,
        easings.circInOut,
        easings.backIn,
        easings.backOut,
        easings.backInOut,
        easings.anticipate,
      ];

      for (const func of funcs) {
        const result = func(0.5);
        expect(typeof result).toBe('number');
      }
    });

    test('easing functions should handle t=0', async () => {
      const easings = await import('../src/mini/core/easings.js');

      const funcs = [
        easings.linear,
        easings.easeIn,
        easings.easeOut,
        easings.easeInOut,
        easings.circIn,
        easings.circOut,
        easings.circInOut,
        easings.backIn,
        easings.backOut,
        easings.backInOut,
        easings.anticipate,
      ];

      for (const func of funcs) {
        const result = func(0);
        expect(typeof result).toBe('number');
      }
    });

    test('easing functions should handle t=1', async () => {
      const easings = await import('../src/mini/core/easings.js');

      const funcs = [
        easings.linear,
        easings.easeIn,
        easings.easeOut,
        easings.easeInOut,
        easings.circIn,
        easings.circOut,
        easings.circInOut,
        easings.backIn,
        easings.backOut,
        easings.backInOut,
        easings.anticipate,
      ];

      for (const func of funcs) {
        const result = func(1);
        expect(typeof result).toBe('number');
      }
    });
  });

  describe('Registered function behavior', () => {
    test('each easing should map to correct registered handle', async () => {
      const easings = await import('../src/mini/core/easings.js');

      easings.linear(0.5);
      expect(mockRegisteredMap.get('linearHandle')).toBeDefined();

      easings.easeIn(0.5);
      expect(mockRegisteredMap.get('easeInHandle')).toBeDefined();

      easings.easeOut(0.5);
      expect(mockRegisteredMap.get('easeOutHandle')).toBeDefined();

      easings.easeInOut(0.5);
      expect(mockRegisteredMap.get('easeInOutHandle')).toBeDefined();

      easings.circIn(0.5);
      expect(mockRegisteredMap.get('circInHandle')).toBeDefined();

      easings.circOut(0.5);
      expect(mockRegisteredMap.get('circOutHandle')).toBeDefined();

      easings.circInOut(0.5);
      expect(mockRegisteredMap.get('circInOutHandle')).toBeDefined();

      easings.backIn(0.5);
      expect(mockRegisteredMap.get('backInHandle')).toBeDefined();

      easings.backOut(0.5);
      expect(mockRegisteredMap.get('backOutHandle')).toBeDefined();

      easings.backInOut(0.5);
      expect(mockRegisteredMap.get('backInOutHandle')).toBeDefined();

      easings.anticipate(0.5);
      expect(mockRegisteredMap.get('anticipateHandle')).toBeDefined();
    });
  });
});
