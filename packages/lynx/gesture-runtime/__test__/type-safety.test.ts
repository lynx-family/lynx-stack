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
import type {
  DefaultGestureConfig,
  FlingGestureConfig,
  GestureConfigType,
  GestureEventType,
  LongPressGestureConfig,
  PanGestureConfig,
  TapGestureConfig,
} from '../src/index.js';

const MainThreadFunction = {
  _wkltId: 'test:type-safety',
};

describe('Type Safety', () => {
  test('PanGesture should have typed config', () => {
    const pan = new PanGesture();
    pan.minDistance(100);

    // TypeScript should infer correct type
    const config: PanGestureConfig = pan.config;
    expect(config.minDistance).toBe(100);
    expect(config.enabled).toBe(true);
  });

  test('TapGesture should have typed config', () => {
    const tap = new TapGesture();
    tap.maxDuration(1000);
    tap.maxDistance(20);
    tap.numberOfTaps(2);

    const config: TapGestureConfig = tap.config;
    expect(config.maxDuration).toBe(1000);
    expect(config.maxDistance).toBe(20);
    expect(config.numberOfTaps).toBe(2);
  });

  test('LongPressGesture should have typed config', () => {
    const longPress = new LongPressGesture();
    longPress.minDuration(800);
    longPress.maxDistance(15);

    const config: LongPressGestureConfig = longPress.config;
    expect(config.minDuration).toBe(800);
    expect(config.maxDistance).toBe(15);
  });

  test('FlingGesture should have typed config', () => {
    const fling = new FlingGesture();

    const config: FlingGestureConfig = fling.config;
    expect(config.enabled).toBe(true);
  });

  test('DefaultScrollGesture should have typed config', () => {
    const defaultScrollGesture = new DefaultScrollGesture();
    defaultScrollGesture.tapSlop(5);

    const config: DefaultGestureConfig = defaultScrollGesture.config;
    expect(config.tapSlop).toBe(5);
  });

  test('Method chaining should preserve type', () => {
    const pan = new PanGesture()
      .minDistance(50)
      // @ts-expect-error Testing runtime behavior
      .onUpdate(MainThreadFunction)
      // @ts-expect-error Testing runtime behavior
      .onEnd(MainThreadFunction);

    // Should still be PanGesture type
    expect(pan).toBeInstanceOf(PanGesture);
    expect(pan.config.minDistance).toBe(50);
  });

  test('Callbacks should be set correctly', () => {
    const pan = new PanGesture();
    // @ts-expect-error Testing runtime behavior
    pan.onUpdate(MainThreadFunction);
    // @ts-expect-error Testing runtime behavior
    pan.onBegin(MainThreadFunction);

    expect(pan.callbacks.onUpdate).toBeDefined();
    expect(pan.callbacks.onBegin).toBeDefined();
  });
});
