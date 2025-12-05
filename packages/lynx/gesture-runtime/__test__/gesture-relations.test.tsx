// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from 'vitest';

import {
  ComposedGesture,
  Gesture,
  LongPressGesture,
  PanGesture,
  TapGesture,
} from '../src/index.js';

describe('Gesture Relations and Edge Cases', () => {
  test('should extend undefined relation with new gestures', () => {
    const pan = new PanGesture();
    const tap = new TapGesture();
    const longPress = new LongPressGesture();

    // Create a fresh pan gesture with no existing relations
    const freshPan = new PanGesture();

    // Verify it starts with empty arrays
    expect(freshPan.simultaneousWith).toHaveLength(0);
    expect(freshPan.waitFor).toHaveLength(0);

    // Now add relations through composition
    const composed = new ComposedGesture(freshPan, tap, longPress);
    composed.simultaneousWith = [pan];
    composed.prepare();

    // The fresh pan should now have the relations
    expect(freshPan.simultaneousWith).toContain(pan);
  });

  test('should handle BaseGesture in prepareSingleGesture', () => {
    const pan = new PanGesture();
    const tap = new TapGesture();
    const fling = new PanGesture();

    const composed = new ComposedGesture(pan, tap);

    // Test prepareSingleGesture with BaseGesture
    composed.prepareSingleGesture(fling, [pan, tap], []);

    expect(fling.simultaneousWith).toContain(pan);
    expect(fling.simultaneousWith).toContain(tap);
  });

  test('should handle ComposedGesture in prepareSingleGesture', () => {
    const pan1 = new PanGesture();
    const pan2 = new PanGesture();
    const tap = new TapGesture();

    const innerComposed = new ComposedGesture(pan1, pan2);
    const outerComposed = new ComposedGesture(innerComposed, tap);

    // Test prepareSingleGesture with ComposedGesture
    outerComposed.prepareSingleGesture(innerComposed, [tap], []);

    expect(innerComposed.simultaneousWith).toContain(tap);
  });

  test('should extend existing relations', () => {
    const pan = new PanGesture();
    const tap = new TapGesture();
    const longPress = new LongPressGesture();
    const fling = new PanGesture();

    // Add initial relation
    pan.externalSimultaneous(tap);
    expect(pan.simultaneousWith).toContain(tap);

    // Now extend with more relations through composition
    const composed = new ComposedGesture(pan, longPress);
    composed.simultaneousWith = [fling];
    composed.prepare();

    // Pan should have both old and new relations
    expect(pan.simultaneousWith).toContain(tap);
    expect(pan.simultaneousWith).toContain(fling);
  });

  test('should handle waitFor relations extension', () => {
    const pan = new PanGesture();
    const tap = new TapGesture();
    const longPress = new LongPressGesture();

    // Add initial waitFor
    pan.externalWaitFor(tap);

    // Extend through composition
    const composed = new ComposedGesture(pan, longPress);
    composed.waitFor = [longPress];
    composed.prepare();

    expect(pan.waitFor).toContain(tap);
    expect(pan.waitFor).toContain(longPress);
  });

  test('should serialize composed gesture with all fields', () => {
    const pan = new PanGesture();
    const tap = new TapGesture();
    const longPress = new LongPressGesture();

    const composed = Gesture.Simultaneous(pan, tap);

    const serialized = composed.serialize();

    expect(serialized.__isSerialized).toBe(true);
    expect(serialized.type).toBeDefined();
    expect(serialized.gestures).toBeDefined();
  });

  test('should handle toJSON on composed gesture', () => {
    const pan = new PanGesture();
    const tap = new TapGesture();

    const composed = Gesture.Exclusive(pan, tap);
    const json = composed.toJSON();

    expect(json).toEqual(composed.serialize());
  });

  test('should flatten nested composed gestures', () => {
    const pan1 = new PanGesture();
    const pan2 = new PanGesture();
    const tap1 = new TapGesture();
    const tap2 = new TapGesture();

    const inner1 = Gesture.Simultaneous(pan1, pan2);
    const inner2 = Gesture.Simultaneous(tap1, tap2);
    const outer = Gesture.Exclusive(inner1, inner2);

    const flattened = outer.toGestureArray();

    expect(flattened).toContain(pan1);
    expect(flattened).toContain(pan2);
    expect(flattened).toContain(tap1);
    expect(flattened).toContain(tap2);
  });

  test('should handle processPanDistance with multiple calls', () => {
    const pan = new PanGesture();
    const tap = new TapGesture();

    const composed = Gesture.Simultaneous(pan, tap) as ComposedGesture;

    // First call
    composed.processPanDistance();
    expect(composed.panProcessed).toBe(true);

    // Second call should return early
    composed.processPanDistance();
    expect(composed.panProcessed).toBe(true);
  });

  test('should handle empty gesture array in toGestureArray', () => {
    const composed = new ComposedGesture();
    const array = composed.toGestureArray();

    expect(array).toHaveLength(0);
  });

  test('should handle single gesture in SimultaneousGesture', () => {
    const pan = new PanGesture();
    const composed = Gesture.Simultaneous(pan);

    expect(composed.gestures).toHaveLength(1);
    expect(composed.gestures[0]).toBe(pan);
  });

  test('should handle ExclusiveGesture with single gesture', () => {
    const pan = new PanGesture();
    const composed = Gesture.Exclusive(pan);

    expect(composed.gestures).toHaveLength(1);
    expect(pan.waitFor).toHaveLength(0);
  });

  test('should handle RaceGesture', () => {
    const pan = new PanGesture();
    const tap = new TapGesture();

    const composed = Gesture.Race(pan, tap);

    expect(composed.gestures).toHaveLength(2);
    expect(composed.gestures[0]).toBe(pan);
    expect(composed.gestures[1]).toBe(tap);
  });
});
