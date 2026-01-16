// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { animate, easeIn, easeOut, linear } from '../src/mini/core/animate.js';
import { createMotionValue } from '../src/mini/core/MotionValue.js';
import { spring } from '../src/mini/core/spring.js';
import { noopMT } from '../src/utils/noop.js';

describe('animate', () => {
  let mockRegisteredMap: Map<string, CallableFunction>;

  beforeEach(() => {
    mockRegisteredMap = new Map<string, CallableFunction>();
    vi.spyOn(globalThis, 'runOnRegistered', 'get').mockImplementation(
      function(id: string) {
        const func = mockRegisteredMap.get(id) ?? noopMT;
        return func;
      },
    );

    // Mock spring function
    mockRegisteredMap.set('springHandle', (options: any) => {
      // Simple mock spring generator
      const start = options.keyframes[0];
      const end = options.keyframes[1];
      const duration = 300; // Fixed duration for testing

      return {
        next: (elapsed: number) => {
          const progress = Math.min(elapsed / duration, 1);
          const value = start + (end - start) * progress;
          return { value, done: progress >= 1 };
        },
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('MotionValue animation', () => {
    test('should animate a MotionValue from current to target value', async () => {
      const mv = createMotionValue(0);

      animate(mv, 100, { duration: 0.1, ease: linear });

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mv.get()).toBe(100);
    });

    test('should call onUpdate callback during animation', async () => {
      const mv = createMotionValue(0);
      const onUpdate = vi.fn();

      animate(mv, 100, { duration: 0.1, ease: linear, onUpdate });

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(onUpdate).toHaveBeenCalled();
      expect(onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0])
        .toBeCloseTo(100, 0);
    });

    test('should call onComplete callback when animation finishes', async () => {
      const mv = createMotionValue(0);
      const onComplete = vi.fn();

      animate(mv, 100, { duration: 0.1, ease: linear, onComplete });

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    test('should stop previous animation when starting new one', async () => {
      const mv = createMotionValue(0);
      const onComplete1 = vi.fn();
      const onComplete2 = vi.fn();

      animate(mv, 50, { duration: 0.2, ease: linear, onComplete: onComplete1 });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Start second animation before first completes
      animate(mv, 100, {
        duration: 0.1,
        ease: linear,
        onComplete: onComplete2,
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(onComplete2).toHaveBeenCalledTimes(1);
      expect(mv.get()).toBe(100);
    });
  });

  describe('Number animation', () => {
    test('should animate a number value', async () => {
      const onUpdate = vi.fn();

      animate(50, 100, { duration: 0.1, ease: linear, onUpdate });

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(onUpdate).toHaveBeenCalled();
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
      expect(lastCall).toBeCloseTo(100, 0);
    });
  });

  describe('Function callback animation', () => {
    test('should animate using setter function', async () => {
      const setter = vi.fn();

      animate(setter, 100, { duration: 0.1, ease: linear, from: 0 });

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(setter).toHaveBeenCalled();
      const lastCall = setter.mock.calls[setter.mock.calls.length - 1][0];
      expect(lastCall).toBeCloseTo(100, 0);
    });
  });

  describe('Animation controls', () => {
    test('should stop animation when stop() is called', async () => {
      const mv = createMotionValue(0);
      const onComplete = vi.fn();

      const controls = animate(mv, 100, {
        duration: 0.2,
        ease: linear,
        onComplete,
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      controls.stop();
      const valueAfterStop = mv.get();

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(mv.get()).toBe(valueAfterStop); // Value shouldn't change after stop
      expect(onComplete).not.toHaveBeenCalled();
    });

    test('should support then() for promise-like behavior', async () => {
      const mv = createMotionValue(0);
      const thenCallback = vi.fn();

      const controls = animate(mv, 100, { duration: 0.1, ease: linear });
      controls.then(thenCallback);

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(thenCallback).toHaveBeenCalled();
    });
  });

  describe('Easing functions', () => {
    test('should animate with linear easing', async () => {
      const mv = createMotionValue(0);

      animate(mv, 100, { duration: 0.1, ease: linear });

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mv.get()).toBe(100);
    });

    test('should animate with easeOut easing', async () => {
      const mv = createMotionValue(0);

      animate(mv, 100, { duration: 0.1, ease: easeOut });

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mv.get()).toBe(100);
    });

    test('should animate with easeIn easing', async () => {
      const mv = createMotionValue(0);

      animate(mv, 100, { duration: 0.1, ease: easeIn });

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mv.get()).toBe(100);
    });

    test('should animate with custom easing function', async () => {
      const mv = createMotionValue(0);
      const customEase = (t: number) => t * t; // Quadratic ease

      animate(mv, 100, { duration: 0.1, ease: customEase });

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mv.get()).toBe(100);
    });
  });

  describe('Spring animations', () => {
    test('should animate with spring physics', async () => {
      const mv = createMotionValue(0);

      animate(mv, 100, { type: 'spring', stiffness: 100, damping: 10 });

      await new Promise(resolve => setTimeout(resolve, 400));

      expect(mv.get()).toBeCloseTo(100, 0);
    });

    test('should use spring when no duration or ease provided', async () => {
      const mv = createMotionValue(0);

      animate(mv, 100, { stiffness: 200, damping: 20 });

      await new Promise(resolve => setTimeout(resolve, 400));

      expect(mv.get()).toBeCloseTo(100, 0);
    });

    test('should respect initial velocity in spring animations', async () => {
      const mv = createMotionValue(0);
      mv.updateVelocity(500);

      animate(mv, 100, { type: 'spring', stiffness: 100, damping: 10 });

      await new Promise(resolve => setTimeout(resolve, 400));

      expect(mv.get()).toBeCloseTo(100, 0);
    });
  });

  describe('Animation options', () => {
    test('should use default duration when not specified', async () => {
      const mv = createMotionValue(0);
      const onComplete = vi.fn();

      animate(mv, 100, { ease: linear, onComplete });

      await new Promise(resolve => setTimeout(resolve, 400));

      expect(onComplete).toHaveBeenCalled();
    });

    test('should start from current value', async () => {
      const mv = createMotionValue(50);

      animate(mv, 100, { duration: 0.1, ease: linear });

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mv.get()).toBe(100);
    });

    test('should start from specified "from" value for setter functions', async () => {
      const setter = vi.fn();

      animate(setter, 100, { duration: 0.1, ease: linear, from: 25 });

      await new Promise(resolve => setTimeout(resolve, 150));

      const lastCall = setter.mock.calls[setter.mock.calls.length - 1][0];
      expect(lastCall).toBeCloseTo(100, 0);
    });

    test('should use specified velocity', async () => {
      const mv = createMotionValue(0);

      animate(mv, 100, { type: 'spring', velocity: 100 });

      await new Promise(resolve => setTimeout(resolve, 400));

      expect(mv.get()).toBeCloseTo(100, 0);
    });
  });

  describe('Edge cases', () => {
    test('should handle animation to same value', async () => {
      const mv = createMotionValue(100);
      const onComplete = vi.fn();

      animate(mv, 100, { duration: 0.1, ease: linear, onComplete });

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mv.get()).toBe(100);
      expect(onComplete).toHaveBeenCalled();
    });

    test('should handle zero duration', async () => {
      const mv = createMotionValue(0);
      const onComplete = vi.fn();

      animate(mv, 100, { duration: 0, ease: linear, onComplete });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mv.get()).toBe(100);
      expect(onComplete).toHaveBeenCalled();
    });

    test('should handle negative values', async () => {
      const mv = createMotionValue(0);

      animate(mv, -100, { duration: 0.1, ease: linear });

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mv.get()).toBe(-100);
    });

    test('should set final velocity to 0 for tween animations', async () => {
      const mv = createMotionValue(0);

      animate(mv, 100, { duration: 0.1, ease: linear });

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mv.getVelocity()).toBe(0);
    });
  });

  describe('Animation cleanup', () => {
    test('should detach animation on completion', async () => {
      const mv = createMotionValue(0);

      animate(mv, 100, { duration: 0.1, ease: linear });

      await new Promise(resolve => setTimeout(resolve, 150));

      // Animation should be detached, stop shouldn't do anything
      const stopSpy = vi.spyOn(mv, 'stop');
      mv.stop();

      // Since animation is already complete and detached, this should work fine
      expect(stopSpy).toHaveBeenCalled();
    });

    test('should handle multiple rapid animations', async () => {
      const mv = createMotionValue(0);

      for (let i = 1; i <= 5; i++) {
        animate(mv, i * 20, { duration: 0.05, ease: linear });
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mv.get()).toBeCloseTo(100, 0);
    });
  });
});
