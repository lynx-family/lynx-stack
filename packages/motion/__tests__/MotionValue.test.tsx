// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createMotionValue } from '../src/mini/core/MotionValue.js';
import { noopMT } from '../src/utils/noop.js';

describe('MotionValue', () => {
  let mockRegisteredMap: Map<string, CallableFunction>;

  beforeEach(() => {
    mockRegisteredMap = new Map<string, CallableFunction>();
    vi.spyOn(globalThis, 'runOnRegistered', 'get').mockImplementation(
      function(id: string) {
        const func = mockRegisteredMap.get(id) ?? noopMT;
        return func;
      },
    );
  });

  describe('createMotionValue', () => {
    test('should create motion value with initial number value', () => {
      const mv = createMotionValue(0);
      expect(mv.get()).toBe(0);
    });

    test('should create motion value with initial string value', () => {
      const mv = createMotionValue('hello');
      expect(mv.get()).toBe('hello');
    });

    test('should create motion value with initial object value', () => {
      const obj = { x: 10, y: 20 };
      const mv = createMotionValue(obj);
      expect(mv.get()).toBe(obj);
    });
  });

  describe('get() and set()', () => {
    test('should get and set number values', () => {
      const mv = createMotionValue(0);
      expect(mv.get()).toBe(0);

      mv.set(100);
      expect(mv.get()).toBe(100);
    });

    test('should get and set string values', () => {
      const mv = createMotionValue('initial');
      expect(mv.get()).toBe('initial');

      mv.set('updated');
      expect(mv.get()).toBe('updated');
    });

    test('should trigger listeners on set', () => {
      const mv = createMotionValue(0);
      const listener = vi.fn();

      mv.onChange(listener);
      mv.set(50);

      expect(listener).toHaveBeenCalledWith(50);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('velocity tracking', () => {
    test('should track velocity on number value changes', () => {
      vi.useFakeTimers();
      const mv = createMotionValue(0);

      mv.set(0);
      vi.advanceTimersByTime(100); // 0.1s
      mv.set(10);

      // velocity = delta / time = 10 / 0.1 = 100
      const velocity = mv.getVelocity();
      expect(velocity).toBeCloseTo(100, 0);

      vi.useRealTimers();
    });

    test('should update velocity on subsequent changes', () => {
      vi.useFakeTimers();
      const mv = createMotionValue(0);

      mv.set(0);
      vi.advanceTimersByTime(100);
      mv.set(10);

      vi.advanceTimersByTime(100);
      mv.set(20);

      // velocity = delta / time = 10 / 0.1 = 100
      const velocity = mv.getVelocity();
      expect(velocity).toBeCloseTo(100, 0);

      vi.useRealTimers();
    });

    test('should not track velocity for non-number values', () => {
      const mv = createMotionValue('a');
      mv.set('b');

      expect(mv.getVelocity()).toBe(0);
    });

    test('should allow manual velocity update', () => {
      const mv = createMotionValue(0);
      mv.updateVelocity(500);

      expect(mv.getVelocity()).toBe(500);
    });
  });

  describe('jump()', () => {
    test('should set value without triggering velocity calculation', () => {
      const mv = createMotionValue(0);
      mv.jump(100);

      expect(mv.get()).toBe(100);
      expect(mv.getVelocity()).toBe(0);
    });

    test('should trigger listeners on jump', () => {
      const mv = createMotionValue(0);
      const listener = vi.fn();

      mv.onChange(listener);
      mv.jump(50);

      expect(listener).toHaveBeenCalledWith(50);
    });

    test('should reset velocity to zero', () => {
      const mv = createMotionValue(0);
      mv.updateVelocity(100);

      mv.jump(50);

      expect(mv.getVelocity()).toBe(0);
    });
  });

  describe('onChange() and on()', () => {
    test('should subscribe to value changes with onChange', () => {
      const mv = createMotionValue(0);
      const listener = vi.fn();

      mv.onChange(listener);

      mv.set(10);
      mv.set(20);
      mv.set(30);

      expect(listener).toHaveBeenCalledTimes(3);
      expect(listener).toHaveBeenNthCalledWith(1, 10);
      expect(listener).toHaveBeenNthCalledWith(2, 20);
      expect(listener).toHaveBeenNthCalledWith(3, 30);
    });

    test('should unsubscribe from value changes', () => {
      const mv = createMotionValue(0);
      const listener = vi.fn();

      const unsubscribe = mv.onChange(listener);

      mv.set(10);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      mv.set(20);
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    test('should support multiple listeners', () => {
      const mv = createMotionValue(0);
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      mv.onChange(listener1);
      mv.onChange(listener2);

      mv.set(10);

      expect(listener1).toHaveBeenCalledWith(10);
      expect(listener2).toHaveBeenCalledWith(10);
    });

    test('should subscribe with on() method', () => {
      const mv = createMotionValue(0);
      const listener = vi.fn();

      const unsubscribe = mv.on('change', listener);

      mv.set(10);

      expect(listener).toHaveBeenCalledWith(10);

      unsubscribe();
      mv.set(20);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('should return noop for unknown event types', () => {
      const mv = createMotionValue(0);
      // @ts-expect-error - testing invalid event type
      const result = mv.on('unknown', vi.fn());

      expect(result).toBe(noopMT);
    });
  });

  describe('attach() and stop()', () => {
    test('should attach animation cancel callbacks', () => {
      const mv = createMotionValue(0);
      const cancel1 = vi.fn();
      const cancel2 = vi.fn();

      mv.attach(cancel1);
      mv.attach(cancel2);

      mv.stop();

      expect(cancel1).toHaveBeenCalledTimes(1);
      expect(cancel2).toHaveBeenCalledTimes(1);
    });

    test('should detach animation on returned function', () => {
      const mv = createMotionValue(0);
      const cancel = vi.fn();

      const detach = mv.attach(cancel);
      detach();

      mv.stop();

      expect(cancel).not.toHaveBeenCalled();
    });

    test('should clear all animations after stop', () => {
      const mv = createMotionValue(0);
      const cancel = vi.fn();

      mv.attach(cancel);
      mv.stop();

      expect(cancel).toHaveBeenCalledTimes(1);

      // Calling stop again shouldn't call cancel again
      mv.stop();
      expect(cancel).toHaveBeenCalledTimes(1);
    });

    test('should support multiple attach/detach cycles', () => {
      const mv = createMotionValue(0);
      const cancel1 = vi.fn();
      const cancel2 = vi.fn();

      const detach1 = mv.attach(cancel1);
      mv.attach(cancel2);

      detach1();
      mv.stop();

      expect(cancel1).not.toHaveBeenCalled();
      expect(cancel2).toHaveBeenCalledTimes(1);
    });
  });

  describe('toJSON()', () => {
    test('should serialize number values', () => {
      const mv = createMotionValue(42);
      expect(mv.toJSON()).toBe('42');
    });

    test('should serialize string values', () => {
      const mv = createMotionValue('hello');
      expect(mv.toJSON()).toBe('hello');
    });

    test('should serialize object values', () => {
      const mv = createMotionValue({ x: 10 });
      expect(mv.toJSON()).toBe('[object Object]');
    });
  });

  describe('integration scenarios', () => {
    test('should handle rapid value changes', () => {
      const mv = createMotionValue(0);
      const listener = vi.fn();

      mv.onChange(listener);

      for (let i = 1; i <= 100; i++) {
        mv.set(i);
      }

      expect(listener).toHaveBeenCalledTimes(100);
      expect(mv.get()).toBe(100);
    });

    test('should handle animation lifecycle', () => {
      const mv = createMotionValue(0);
      const cancel = vi.fn();
      const listener = vi.fn();

      mv.onChange(listener);
      const detach = mv.attach(cancel);

      mv.set(50);
      expect(listener).toHaveBeenCalledWith(50);

      mv.stop();
      expect(cancel).toHaveBeenCalled();

      mv.set(100);
      expect(listener).toHaveBeenCalledWith(100);
    });
  });

  describe('isAnimating()', () => {
    test('should return false when no animations are active', () => {
      const mv = createMotionValue(0);
      expect(mv.isAnimating()).toBe(false);
    });

    test('should return true when animations are attached', () => {
      const mv = createMotionValue(0);
      const cancel = vi.fn();

      mv.attach(cancel);

      expect(mv.isAnimating()).toBe(true);
    });

    test('should return false after stop is called', () => {
      const mv = createMotionValue(0);
      const cancel = vi.fn();

      mv.attach(cancel);
      expect(mv.isAnimating()).toBe(true);

      mv.stop();
      expect(mv.isAnimating()).toBe(false);
    });

    test('should return false after animation is detached', () => {
      const mv = createMotionValue(0);
      const cancel = vi.fn();

      const detach = mv.attach(cancel);
      expect(mv.isAnimating()).toBe(true);

      detach();
      expect(mv.isAnimating()).toBe(false);
    });

    test('should track multiple animations', () => {
      const mv = createMotionValue(0);

      const detach1 = mv.attach(vi.fn());
      expect(mv.isAnimating()).toBe(true);

      const detach2 = mv.attach(vi.fn());
      expect(mv.isAnimating()).toBe(true);

      detach1();
      expect(mv.isAnimating()).toBe(true); // Still one active

      detach2();
      expect(mv.isAnimating()).toBe(false); // All cleared
    });
  });

  describe('clearListeners()', () => {
    test('should remove all listeners', () => {
      const mv = createMotionValue(0);
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      mv.onChange(listener1);
      mv.onChange(listener2);

      mv.set(10);
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      mv.clearListeners();

      mv.set(20);
      expect(listener1).toHaveBeenCalledTimes(1); // Not called again
      expect(listener2).toHaveBeenCalledTimes(1); // Not called again
    });

    test('should allow adding new listeners after clearing', () => {
      const mv = createMotionValue(0);
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      mv.onChange(listener1);
      mv.clearListeners();
      mv.onChange(listener2);

      mv.set(10);

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledWith(10);
    });
  });

  describe('destroy()', () => {
    test('should stop all animations and clear all listeners', () => {
      const mv = createMotionValue(0);
      const cancel = vi.fn();
      const listener = vi.fn();

      mv.attach(cancel);
      mv.onChange(listener);

      expect(mv.isAnimating()).toBe(true);

      mv.destroy();

      expect(cancel).toHaveBeenCalled();
      expect(mv.isAnimating()).toBe(false);

      mv.set(10);
      expect(listener).not.toHaveBeenCalled();
    });

    test('should be idempotent', () => {
      const mv = createMotionValue(0);
      const cancel = vi.fn();

      mv.attach(cancel);

      mv.destroy();
      expect(cancel).toHaveBeenCalledTimes(1);

      // Calling destroy again should not cause issues
      mv.destroy();
      expect(cancel).toHaveBeenCalledTimes(1); // Still 1
    });

    test('should allow value operations after destroy', () => {
      const mv = createMotionValue(0);

      mv.destroy();

      // Should still work
      mv.set(10);
      expect(mv.get()).toBe(10);

      mv.jump(20);
      expect(mv.get()).toBe(20);
    });
  });
});
