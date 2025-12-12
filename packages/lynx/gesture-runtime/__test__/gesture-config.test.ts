// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from 'vitest';

import {
  DefaultScrollGesture,
  FlingGesture,
  LongPressGesture,
  PanGesture,
  TapGesture,
} from '../src/index.js';

describe('Gesture Configuration', () => {
  describe('PanGesture', () => {
    test('should set minDistance', () => {
      const pan = new PanGesture();
      pan.minDistance(50);
      expect(pan.config.minDistance).toBe(50);
    });

    test('should track if distance was set by user', () => {
      const pan = new PanGesture();
      expect(pan.distanceSet).toBe(false);

      pan.minDistance(100);
      expect(pan.distanceSet).toBe(true);
    });

    test('should reset distanceSet when minDistance is undefined', () => {
      const pan = new PanGesture();
      pan.minDistance(100);
      expect(pan.distanceSet).toBe(true);

      // @ts-expect-error Testing runtime behavior
      pan.minDistance(undefined);
      expect(pan.distanceSet).toBe(false);
    });

    test('should override default minDistance', () => {
      const pan = new PanGesture();
      pan.overrideDefaultMinDistance();
      expect(pan.config.minDistance).toBe(10); // DEFAULT_DISTANCE
    });

    test('should not override user-set minDistance', () => {
      const pan = new PanGesture();
      pan.minDistance(50);
      pan.overrideDefaultMinDistance();
      expect(pan.config.minDistance).toBe(50);
    });

    test('should support method chaining', () => {
      const pan = new PanGesture()
        .minDistance(20)
        .enabled(false);

      expect(pan.config.minDistance).toBe(20);
      expect(pan.config.enabled).toBe(false);
    });
  });

  describe('TapGesture', () => {
    test('should set maxDuration', () => {
      const tap = new TapGesture();
      tap.maxDuration(300);
      expect(tap.config.maxDuration).toBe(300);
    });

    test('should set maxDistance', () => {
      const tap = new TapGesture();
      tap.maxDistance(15);
      expect(tap.config.maxDistance).toBe(15);
    });

    test('should set numberOfTaps', () => {
      const tap = new TapGesture();
      tap.numberOfTaps(2);
      expect(tap.config.numberOfTaps).toBe(2);
    });

    test('should support method chaining', () => {
      const tap = new TapGesture()
        .maxDuration(400)
        .maxDistance(20)
        .numberOfTaps(3);

      expect(tap.config.maxDuration).toBe(400);
      expect(tap.config.maxDistance).toBe(20);
      expect(tap.config.numberOfTaps).toBe(3);
    });

    test('should have default values', () => {
      const tap = new TapGesture();
      expect(tap.config.enabled).toBe(true);
      expect(tap.config.maxDuration).toBe(500);
      expect(tap.config.maxDistance).toBe(10);
    });
  });

  describe('LongPressGesture', () => {
    test('should set minDuration', () => {
      const longPress = new LongPressGesture();
      longPress.minDuration(800);
      expect(longPress.config.minDuration).toBe(800);
    });

    test('should set maxDistance', () => {
      const longPress = new LongPressGesture();
      longPress.maxDistance(5);
      expect(longPress.config.maxDistance).toBe(5);
    });

    test('should support method chaining', () => {
      const longPress = new LongPressGesture()
        .minDuration(1000)
        .maxDistance(8);

      expect(longPress.config.minDuration).toBe(1000);
      expect(longPress.config.maxDistance).toBe(8);
    });

    test('should have default values', () => {
      const longPress = new LongPressGesture();
      expect(longPress.config.enabled).toBe(true);
      expect(longPress.config.minDuration).toBe(500);
      expect(longPress.config.maxDistance).toBe(10);
    });
  });

  describe('FlingGesture', () => {
    test('should create with default config', () => {
      const fling = new FlingGesture();
      expect(fling.config.enabled).toBe(true);
    });

    test('should support enabled configuration', () => {
      const fling = new FlingGesture();
      fling.enabled(false);
      expect(fling.config.enabled).toBe(false);
    });
  });

  describe('DefaultScrollGesture', () => {
    test('should set tapSlop', () => {
      const defaultScrollGesture = new DefaultScrollGesture();
      defaultScrollGesture.tapSlop(5);
      expect(defaultScrollGesture.config.tapSlop).toBe(5);
    });

    test('should have default tapSlop value', () => {
      const defaultScrollGesture = new DefaultScrollGesture();
      expect(defaultScrollGesture.config.tapSlop).toBe(3);
    });

    test('should support method chaining', () => {
      const defaultScrollGesture = new DefaultScrollGesture()
        .tapSlop(7)
        .enabled(false);

      expect(defaultScrollGesture.config.tapSlop).toBe(7);
      expect(defaultScrollGesture.config.enabled).toBe(false);
    });
  });

  describe('Common Configuration', () => {
    test('all gestures should support enabled()', () => {
      const gestures = [
        new PanGesture(),
        new TapGesture(),
        new LongPressGesture(),
        new FlingGesture(),
        new DefaultScrollGesture(),
      ];

      gestures.forEach((gesture) => {
        gesture.enabled(false);
        expect(gesture.config.enabled).toBe(false);
      });
    });

    test('all gestures should have unique IDs', () => {
      const gestures = [
        new PanGesture(),
        new TapGesture(),
        new LongPressGesture(),
        new FlingGesture(),
        new DefaultScrollGesture(),
      ];

      const ids = gestures.map((g) => g.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(gestures.length);
    });

    test('all gestures should start with execId 0', () => {
      const gestures = [
        new PanGesture(),
        new TapGesture(),
        new LongPressGesture(),
        new FlingGesture(),
        new DefaultScrollGesture(),
      ];

      gestures.forEach((gesture) => {
        expect(gesture.execId).toBe(0);
      });
    });

    test('execId should increment on config change', () => {
      const pan = new PanGesture();
      expect(pan.execId).toBe(0);

      pan.minDistance(10);
      expect(pan.execId).toBe(1);

      pan.enabled(false);
      expect(pan.execId).toBe(2);
    });
  });
});
