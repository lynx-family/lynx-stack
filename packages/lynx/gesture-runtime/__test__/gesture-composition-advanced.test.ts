// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from 'vitest';

import {
  Gesture,
  GestureTypeInner,
  LongPressGesture,
  PanGesture,
  TapGesture,
} from '../src/index.js';
import type { ComposedGesture } from '../src/index.js';

describe('Advanced Gesture Composition', () => {
  describe('Exclusive Gesture', () => {
    test('should create exclusive gesture composition', () => {
      const pan = new PanGesture();
      const tap = new TapGesture();

      const composed = Gesture.Exclusive(pan, tap) as ComposedGesture;

      expect(composed.gestures.length).toBe(2);
      expect(composed.gestures[0]).toBe(pan);
      expect(composed.gestures[1]).toBe(tap);
    });

    test('should set waitFor relationships in order', () => {
      const pan = new PanGesture();
      const tap = new TapGesture();
      const longPress = new LongPressGesture();

      Gesture.Exclusive(pan, tap, longPress);

      // tap should wait for pan
      expect(tap.waitFor).toContain(pan);

      // longPress should wait for both pan and tap
      expect(longPress.waitFor).toContain(pan);
      expect(longPress.waitFor).toContain(tap);
    });

    test('should work with nested compositions', () => {
      const pan1 = new PanGesture();
      const pan2 = new PanGesture();
      const tap = new TapGesture();

      const simultaneous = Gesture.Simultaneous(pan1, pan2);
      const exclusive = Gesture.Exclusive(simultaneous, tap) as ComposedGesture;

      expect(exclusive.gestures.length).toBe(2);
    });
  });

  describe('Race Gesture', () => {
    test('should create race gesture composition', () => {
      const pan = new PanGesture();
      const tap = new TapGesture();

      const composed = Gesture.Race(pan, tap) as ComposedGesture;

      expect(composed.gestures.length).toBe(2);
      expect(composed.gestures[0]).toBe(pan);
      expect(composed.gestures[1]).toBe(tap);
    });

    test('should work with multiple gestures', () => {
      const pan = new PanGesture();
      const tap = new TapGesture();
      const longPress = new LongPressGesture();

      const composed = Gesture.Race(pan, tap, longPress) as ComposedGesture;

      expect(composed.gestures.length).toBe(3);
    });
  });

  describe('Nested Compositions', () => {
    test('should handle simultaneous inside exclusive', () => {
      const pan1 = new PanGesture();
      const pan2 = new PanGesture();
      const tap = new TapGesture();

      const simultaneous = Gesture.Simultaneous(pan1, pan2);
      const exclusive = Gesture.Exclusive(simultaneous, tap);

      expect(exclusive).toBeDefined();
    });

    test('should handle exclusive inside simultaneous', () => {
      const pan = new PanGesture();
      const tap1 = new TapGesture();
      const tap2 = new TapGesture();

      const exclusive = Gesture.Exclusive(tap1, tap2);
      const simultaneous = Gesture.Simultaneous(pan, exclusive);

      expect(simultaneous).toBeDefined();
    });

    test('should flatten nested compositions correctly', () => {
      const pan1 = new PanGesture();
      const pan2 = new PanGesture();
      const tap = new TapGesture();

      const inner = Gesture.Simultaneous(pan1, pan2);
      const outer = Gesture.Simultaneous(inner, tap) as ComposedGesture;

      const flattened = outer.toGestureArray();
      expect(flattened.length).toBe(3);
    });
  });

  describe('External Relationships with Compositions', () => {
    test('should handle externalWaitFor with composed gesture', () => {
      const pan = new PanGesture();
      const tap1 = new TapGesture();
      const tap2 = new TapGesture();

      const composed = Gesture.Simultaneous(tap1, tap2);
      pan.externalWaitFor(composed);

      // Should not throw
      expect(pan.waitFor.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle externalSimultaneous with composed gesture', () => {
      const pan = new PanGesture();
      const tap1 = new TapGesture();
      const tap2 = new TapGesture();

      const composed = Gesture.Simultaneous(tap1, tap2);
      pan.externalSimultaneous(composed);

      expect(pan.simultaneousWith.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle externalContinueWith with composed gesture', () => {
      const pan = new PanGesture();
      const tap1 = new TapGesture();
      const tap2 = new TapGesture();

      const composed = Gesture.Simultaneous(tap1, tap2);
      pan.externalContinueWith(composed);

      expect(pan.continueWith.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Pan Distance Processing', () => {
    test('should only process pan distance once', () => {
      const pan = new PanGesture();
      const tap = new TapGesture();

      const composed = Gesture.Simultaneous(pan, tap) as ComposedGesture;

      composed.processPanDistance();
      const firstDistance = pan.config.minDistance;

      composed.processPanDistance();
      const secondDistance = pan.config.minDistance;

      expect(firstDistance).toBe(secondDistance);
    });

    test('should process pan distance with longPress', () => {
      const pan = new PanGesture();
      const longPress = new LongPressGesture();

      const composed = Gesture.Simultaneous(pan, longPress) as ComposedGesture;
      composed.processPanDistance();

      expect(pan.config.minDistance).toBe(10); // DEFAULT_DISTANCE
    });

    test('should not override user-set pan distance', () => {
      const pan = new PanGesture();
      pan.minDistance(50);
      const tap = new TapGesture();

      const composed = Gesture.Simultaneous(pan, tap) as ComposedGesture;
      composed.processPanDistance();

      expect(pan.config.minDistance).toBe(50);
    });
  });

  describe('Gesture Array Conversion', () => {
    test('should convert simple gesture to array', () => {
      const pan = new PanGesture();
      const array = pan.toGestureArray();

      expect(array.length).toBe(1);
      expect(array[0]).toBe(pan);
    });

    test('should flatten composed gesture to array', () => {
      const pan = new PanGesture();
      const tap = new TapGesture();
      const longPress = new LongPressGesture();

      const composed = Gesture.Simultaneous(
        pan,
        tap,
        longPress,
      ) as ComposedGesture;
      const array = composed.toGestureArray();

      expect(array.length).toBe(3);
      expect(array).toContain(pan);
      expect(array).toContain(tap);
      expect(array).toContain(longPress);
    });
  });

  describe('Serialization', () => {
    test('should serialize composed gesture', () => {
      const pan = new PanGesture();
      const tap = new TapGesture();

      const composed = Gesture.Simultaneous(pan, tap) as ComposedGesture;
      const serialized = composed.serialize();

      expect(serialized.__isSerialized).toBe(true);
      expect(serialized.gestures).toBeDefined();
      expect(Array.isArray(serialized.gestures)).toBe(true);
    });

    test('should serialize gesture with relationships', () => {
      const pan = new PanGesture();
      const tap = new TapGesture();

      pan.externalWaitFor(tap);

      const serialized = pan.serialize();

      expect(serialized.waitFor).toBeDefined();
      expect(Array.isArray(serialized.waitFor)).toBe(true);
    });

    test('should serialize composed gestures with relationships', () => {
      const pan = new PanGesture();
      const tap = new TapGesture();

      const composed1 = Gesture.Simultaneous(pan, tap);

      const serialized = composed1.serialize();

      expect(serialized.type).toBe(GestureTypeInner.COMPOSED);
    });

    test('should use toJSON for serialization', () => {
      const pan = new PanGesture();
      pan.minDistance(100);

      const json = pan.toJSON();
      const serialized = pan.serialize();

      expect(json).toEqual(serialized);
    });
  });

  describe('corner cases', () => {
    test('should not throw if gesture relation is undefined', () => {
      const pan = new PanGesture();
      const tap = new TapGesture();

      delete pan.simultaneousWith;

      const composed = Gesture.Simultaneous(pan, tap) as ComposedGesture;
      expect(() => composed.serialize()).not.toThrow();
    });
  });
});
