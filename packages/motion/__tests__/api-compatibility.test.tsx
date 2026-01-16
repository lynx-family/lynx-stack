// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from 'vitest';

import { motionValue as motionValueFull } from 'motion-dom';

import { createMotionValue as createMotionValueMini } from '../src/mini/core/MotionValue.js';
import type { MotionValue as MotionValueMini } from '../src/mini/core/MotionValue.js';

/**
 * API Compatibility Tests
 *
 * These tests ensure that the mini version of the motion library maintains
 * API compatibility with the standard motion-dom library. This is critical
 * to prevent breaking changes during future iterations.
 */

describe('API Compatibility: motion-mini vs motion-dom', () => {
  describe('MotionValue Interface', () => {
    test('both should have get() method', () => {
      const miniMV = createMotionValueMini(0);
      const fullMV = motionValueFull(0);

      expect(typeof miniMV.get).toBe('function');
      expect(typeof fullMV.get).toBe('function');

      expect(miniMV.get()).toBe(0);
      expect(fullMV.get()).toBe(0);
    });

    test('both should have set() method', () => {
      const miniMV = createMotionValueMini(0);
      const fullMV = motionValueFull(0);

      expect(typeof miniMV.set).toBe('function');
      expect(typeof fullMV.set).toBe('function');

      miniMV.set(100);
      fullMV.set(100);

      expect(miniMV.get()).toBe(100);
      expect(fullMV.get()).toBe(100);
    });

    test('both should have onChange() method with same signature', () => {
      const miniMV = createMotionValueMini(0);
      const fullMV = motionValueFull(0);

      expect(typeof miniMV.onChange).toBe('function');
      expect(typeof fullMV.onChange).toBe('function');

      let miniCalled = false;
      let fullCalled = false;

      const miniUnsub = miniMV.onChange((v) => {
        miniCalled = true;
        expect(v).toBe(50);
      });

      const fullUnsub = fullMV.onChange((v) => {
        fullCalled = true;
        expect(v).toBe(50);
      });

      miniMV.set(50);
      fullMV.set(50);

      expect(miniCalled).toBe(true);
      expect(fullCalled).toBe(true);

      // Both should return unsubscribe function
      expect(typeof miniUnsub).toBe('function');
      expect(typeof fullUnsub).toBe('function');

      miniUnsub();
      fullUnsub();
    });

    test('both should have on() method for event subscription', () => {
      const miniMV = createMotionValueMini(0);
      const fullMV = motionValueFull(0);

      expect(typeof miniMV.on).toBe('function');
      expect(typeof fullMV.on).toBe('function');

      let miniCalled = false;
      let fullCalled = false;

      const miniUnsub = miniMV.on('change', (v) => {
        miniCalled = true;
      });

      const fullUnsub = fullMV.on('change', (v) => {
        fullCalled = true;
      });

      miniMV.set(75);
      fullMV.set(75);

      expect(miniCalled).toBe(true);
      expect(fullCalled).toBe(true);

      miniUnsub();
      fullUnsub();
    });

    test('both should have getVelocity() method', () => {
      const miniMV = createMotionValueMini(0);
      const fullMV = motionValueFull(0);

      expect(typeof miniMV.getVelocity).toBe('function');
      expect(typeof fullMV.getVelocity).toBe('function');

      // Both should return a number
      expect(typeof miniMV.getVelocity()).toBe('number');
      expect(typeof fullMV.getVelocity()).toBe('number');
    });

    test('both should have stop() method', () => {
      const miniMV = createMotionValueMini(0);
      const fullMV = motionValueFull(0);

      expect(typeof miniMV.stop).toBe('function');
      expect(typeof fullMV.stop).toBe('function');

      // Should not throw when called
      expect(() => miniMV.stop()).not.toThrow();
      expect(() => fullMV.stop()).not.toThrow();
    });

    test('both should have isAnimating() method', () => {
      const miniMV = createMotionValueMini(0);
      const fullMV = motionValueFull(0);

      expect(typeof miniMV.isAnimating).toBe('function');
      expect(typeof fullMV.isAnimating).toBe('function');

      // Should return boolean
      expect(typeof miniMV.isAnimating()).toBe('boolean');
      expect(typeof fullMV.isAnimating()).toBe('boolean');

      // Initially should not be animating
      expect(miniMV.isAnimating()).toBe(false);
      expect(fullMV.isAnimating()).toBe(false);
    });

    test('both should have clearListeners() method', () => {
      const miniMV = createMotionValueMini(0);
      const fullMV = motionValueFull(0);

      expect(typeof miniMV.clearListeners).toBe('function');
      expect(typeof fullMV.clearListeners).toBe('function');

      // Should not throw when called
      expect(() => miniMV.clearListeners()).not.toThrow();
      expect(() => fullMV.clearListeners()).not.toThrow();
    });

    test('both should have destroy() method', () => {
      const miniMV = createMotionValueMini(0);
      const fullMV = motionValueFull(0);

      expect(typeof miniMV.destroy).toBe('function');
      expect(typeof fullMV.destroy).toBe('function');

      // Should not throw when called
      expect(() => miniMV.destroy()).not.toThrow();
      expect(() => fullMV.destroy()).not.toThrow();
    });

    test('mini should have jump() method (extension)', () => {
      const miniMV = createMotionValueMini(0);

      expect(typeof miniMV.jump).toBe('function');

      miniMV.jump(100);
      expect(miniMV.get()).toBe(100);
    });

    test('both should support type parameter', () => {
      // Number
      const miniNum = createMotionValueMini<number>(0);
      const fullNum = motionValueFull<number>(0);

      miniNum.set(42);
      fullNum.set(42);

      expect(miniNum.get()).toBe(42);
      expect(fullNum.get()).toBe(42);

      // String
      const miniStr = createMotionValueMini<string>('hello');
      const fullStr = motionValueFull<string>('hello');

      miniStr.set('world');
      fullStr.set('world');

      expect(miniStr.get()).toBe('world');
      expect(fullStr.get()).toBe('world');
    });
  });

  describe('Event Callback Signatures', () => {
    test('onChange callback should receive current value', () => {
      const miniMV = createMotionValueMini(0);
      const fullMV = motionValueFull(0);

      const miniCallback = (v: number) => {
        expect(typeof v).toBe('number');
        expect(v).toBe(123);
      };

      const fullCallback = (v: number) => {
        expect(typeof v).toBe('number');
        expect(v).toBe(123);
      };

      miniMV.onChange(miniCallback);
      fullMV.onChange(fullCallback);

      miniMV.set(123);
      fullMV.set(123);
    });

    test('on("change") callback should match onChange', () => {
      const miniMV = createMotionValueMini(0);
      const fullMV = motionValueFull(0);

      let miniValue = 0;
      let fullValue = 0;

      miniMV.on('change', (v) => {
        miniValue = v;
      });

      fullMV.on('change', (v) => {
        fullValue = v;
      });

      miniMV.set(999);
      fullMV.set(999);

      expect(miniValue).toBe(999);
      expect(fullValue).toBe(999);
    });
  });

  describe('Return Types', () => {
    test('get() should return the value type', () => {
      const miniMV = createMotionValueMini(42);
      const fullMV = motionValueFull(42);

      const miniResult = miniMV.get();
      const fullResult = fullMV.get();

      expect(typeof miniResult).toBe('number');
      expect(typeof fullResult).toBe('number');
    });

    test('set() should return void', () => {
      const miniMV = createMotionValueMini(0);
      const fullMV = motionValueFull(0);

      const miniResult = miniMV.set(10);
      const fullResult = fullMV.set(10);

      expect(miniResult).toBeUndefined();
      expect(fullResult).toBeUndefined();
    });

    test('onChange() should return unsubscribe function', () => {
      const miniMV = createMotionValueMini(0);
      const fullMV = motionValueFull(0);

      const miniUnsub = miniMV.onChange(() => {});
      const fullUnsub = fullMV.onChange(() => {});

      expect(typeof miniUnsub).toBe('function');
      expect(typeof fullUnsub).toBe('function');
    });

    test('getVelocity() should return number', () => {
      const miniMV = createMotionValueMini(0);
      const fullMV = motionValueFull(0);

      const miniVel = miniMV.getVelocity();
      const fullVel = fullMV.getVelocity();

      expect(typeof miniVel).toBe('number');
      expect(typeof fullVel).toBe('number');
    });
  });

  describe('Behavior Compatibility', () => {
    test('both should notify listeners on set', () => {
      const miniMV = createMotionValueMini(0);
      const fullMV = motionValueFull(0);

      let miniNotified = 0;
      let fullNotified = 0;

      miniMV.onChange(() => miniNotified++);
      fullMV.onChange(() => fullNotified++);

      miniMV.set(1);
      fullMV.set(1);

      expect(miniNotified).toBe(1);
      expect(fullNotified).toBe(1);

      miniMV.set(2);
      fullMV.set(2);

      expect(miniNotified).toBe(2);
      expect(fullNotified).toBe(2);
    });

    test('both should support multiple listeners', () => {
      const miniMV = createMotionValueMini(0);
      const fullMV = motionValueFull(0);

      let miniCount1 = 0, miniCount2 = 0;
      let fullCount1 = 0, fullCount2 = 0;

      miniMV.onChange(() => miniCount1++);
      miniMV.onChange(() => miniCount2++);

      fullMV.onChange(() => fullCount1++);
      fullMV.onChange(() => fullCount2++);

      miniMV.set(100);
      fullMV.set(100);

      expect(miniCount1).toBe(1);
      expect(miniCount2).toBe(1);
      expect(fullCount1).toBe(1);
      expect(fullCount2).toBe(1);
    });

    test('both should properly unsubscribe listeners', () => {
      const miniMV = createMotionValueMini(0);
      const fullMV = motionValueFull(0);

      let miniCalled = 0;
      let fullCalled = 0;

      const miniUnsub = miniMV.onChange(() => miniCalled++);
      const fullUnsub = fullMV.onChange(() => fullCalled++);

      miniMV.set(1);
      fullMV.set(1);

      expect(miniCalled).toBe(1);
      expect(fullCalled).toBe(1);

      miniUnsub();
      fullUnsub();

      miniMV.set(2);
      fullMV.set(2);

      expect(miniCalled).toBe(1); // Should not increment
      expect(fullCalled).toBe(1); // Should not increment
    });

    test('both should maintain separate listener lists', () => {
      const miniMV1 = createMotionValueMini(0);
      const miniMV2 = createMotionValueMini(0);

      const fullMV1 = motionValueFull(0);
      const fullMV2 = motionValueFull(0);

      let miniCount1 = 0, miniCount2 = 0;
      let fullCount1 = 0, fullCount2 = 0;

      miniMV1.onChange(() => miniCount1++);
      miniMV2.onChange(() => miniCount2++);

      fullMV1.onChange(() => fullCount1++);
      fullMV2.onChange(() => fullCount2++);

      miniMV1.set(1);
      fullMV1.set(1);

      expect(miniCount1).toBe(1);
      expect(miniCount2).toBe(0);
      expect(fullCount1).toBe(1);
      expect(fullCount2).toBe(0);
    });
  });

  describe('Critical Compatibility Notes', () => {
    test('mini extends standard with jump() method', () => {
      const miniMV = createMotionValueMini(0);

      // This is an extension in mini, not in standard
      expect(typeof miniMV.jump).toBe('function');

      miniMV.jump(100);
      expect(miniMV.get()).toBe(100);
      expect(miniMV.getVelocity()).toBe(0);
    });

    test('mini extends standard with attach() method', () => {
      const miniMV = createMotionValueMini(0);

      // This is an extension in mini for animation management
      expect(typeof (miniMV as any).attach).toBe('function');
    });

    test('API surface should be compatible for migration', () => {
      // This test documents that code using standard motion-dom MotionValue
      // can also work with mini MotionValue (mini maintains API compatibility)
      // motion-dom is the SUPERSET, motion-mini is the lightweight SUBSET
      const useMotionValue = (
        mv: MotionValueMini | ReturnType<typeof motionValueFull>,
      ) => {
        const value = mv.get();
        mv.set(value + 1);

        const unsub = mv.onChange((v) => {
          expect(v).toBe(value + 1);
        });

        const velocity = mv.getVelocity();
        expect(typeof velocity).toBe('number');

        return unsub;
      };

      const miniMV = createMotionValueMini(0);
      const fullMV = motionValueFull(0);

      const miniUnsub = useMotionValue(miniMV);
      const fullUnsub = useMotionValue(fullMV);

      expect(typeof miniUnsub).toBe('function');
      expect(typeof fullUnsub).toBe('function');
    });
  });
});
