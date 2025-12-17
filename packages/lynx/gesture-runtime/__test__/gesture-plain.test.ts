// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, describe, expect, test } from 'vitest';

import {
  DefaultScrollGesture,
  FlingGesture,
  Gesture,
  GestureTypeInner,
  LongPressGesture,
  PanGesture,
  TapGesture,
} from '../src/index.js';
import type { ComposedGesture } from '../src/index.js';
import { DEFAULT_DISTANCE } from '../src/utils/const.js';

const MainThreadFunction = {
  _wkltId: 'bdd4:dd564:2',
};

describe('create gesture', () => {
  test('gesture type', () => {
    const panGesture = new PanGesture();
    const flingGesture = new FlingGesture();
    const tapGesture = new TapGesture();
    const longPressGesture = new LongPressGesture();

    expect(panGesture.type).toBe(GestureTypeInner.PAN);
    expect(flingGesture.type).toBe(GestureTypeInner.FLING);
    expect(tapGesture.type).toBe(GestureTypeInner.TAP);
    expect(longPressGesture.type).toBe(GestureTypeInner.LONGPRESS);
  });

  test('gesture config', () => {
    const panGesture = new PanGesture();
    panGesture.minDistance(100);

    expect(panGesture.config.minDistance).toBe(100);

    const longPressGesture = new LongPressGesture();
    longPressGesture.minDuration(1000);
    longPressGesture.maxDistance(200);

    expect(longPressGesture.config.minDuration).toBe(1000);
    expect(longPressGesture.config.maxDistance).toBe(200);

    const tapGesture = new TapGesture();
    tapGesture.maxDuration(1000);
    tapGesture.maxDistance(200);

    expect(tapGesture.config.maxDuration).toBe(1000);
    expect(tapGesture.config.maxDistance).toBe(200);
  });

  test('gesture non main thread callback', () => {
    const panGesture = new PanGesture();

    expect(() =>
      panGesture.onUpdate((event) => {
        // Non Main Thread Callback
      })
    ).toThrow(
      `Gesture callback for 'onUpdate' must be a main thread function`,
    );
  });

  test('gesture callbacks should have callbacks set', () => {
    const panGesture = new TapGesture();
    // @ts-expect-error Expected
    panGesture.onBegin(MainThreadFunction);
    // @ts-expect-error Expected
    panGesture.onEnd(MainThreadFunction);
    // @ts-expect-error Expected
    panGesture.onTouchesDown(MainThreadFunction);
    // @ts-expect-error Expected
    panGesture.onTouchesMove(MainThreadFunction);
    // @ts-expect-error Expected
    panGesture.onTouchesUp(MainThreadFunction);
    // @ts-expect-error Expected
    panGesture.onTouchesCancel(MainThreadFunction);

    expect(panGesture.callbacks.onBegin).toMatchObject({
      _c: {},
      _wkltId: expect.any(String),
    });
    expect(panGesture.callbacks.onEnd).toMatchObject({
      _c: {},
      _wkltId: expect.any(String),
    });
    expect(panGesture.callbacks.onTouchesDown).toMatchObject({
      _c: {},
      _wkltId: expect.any(String),
    });
    expect(panGesture.callbacks.onTouchesMove).toMatchObject({
      _c: {},
      _wkltId: expect.any(String),
    });
    expect(panGesture.callbacks.onTouchesUp).toMatchObject({
      _c: {},
      _wkltId: expect.any(String),
    });
    expect(panGesture.callbacks.onTouchesCancel).toMatchObject({
      _c: {},
      _wkltId: expect.any(String),
    });
  });

  test('clone should have equal properties', () => {
    const defaultScrollGesture = new DefaultScrollGesture();
    defaultScrollGesture.tapSlop(100);

    const cloned = defaultScrollGesture.clone();

    expect(cloned).toMatchObject(defaultScrollGesture);
  });
});

describe('gesture composition', () => {
  test('Simultaneous Should have gestures in simultaneousWith', () => {
    const panGesture = new PanGesture();
    const tapGesture = new TapGesture();

    const composed = Gesture.Simultaneous(
      panGesture,
      tapGesture,
    ) as ComposedGesture;

    expect(composed.gestures.length).toBe(2);
    expect(composed.gestures[0]).toBe(panGesture);
    expect(composed.gestures[1]).toBe(tapGesture);

    expect(panGesture.simultaneousWith).toContain(tapGesture);
    expect(tapGesture.simultaneousWith).toContain(panGesture);
  });

  test('pan gesture with tap have default minDistance', () => {
    const panGesture = new PanGesture();
    const tapGesture = new TapGesture();

    const composed = Gesture.Simultaneous(
      panGesture,
      tapGesture,
    ) as ComposedGesture;
    composed.processPanDistance();

    expect(panGesture.config.minDistance).toBe(DEFAULT_DISTANCE);

    const panGesture2 = new PanGesture();
    panGesture2.minDistance(100);
    const tapGesture2 = new TapGesture();

    const composed2 = Gesture.Simultaneous(
      panGesture2,
      tapGesture2,
    ) as ComposedGesture;
    composed2.processPanDistance();

    expect(panGesture2.config.minDistance).toBe(100);
  });

  test('externalWaitFor should have gestures in waitFor', () => {
    const panGesture = new PanGesture();
    const tapGesture = new TapGesture();

    tapGesture.externalWaitFor(panGesture);

    expect(tapGesture.waitFor).toContain(panGesture);
  });

  test('externalSimultaneous should have gestures in simultaneousWith', () => {
    const panGesture = new PanGesture();
    const tapGesture = new TapGesture();

    panGesture.externalSimultaneous(tapGesture);

    expect(panGesture.simultaneousWith).toContain(tapGesture);
  });

  test('externalContinueWith should have gestures in continueWith', () => {
    const panGesture = new PanGesture();
    const tapGesture = new TapGesture();

    panGesture.externalContinueWith(tapGesture);

    expect(panGesture.continueWith).toContain(tapGesture);
  });

  test('self external should being skipped', () => {
    const panGesture = new PanGesture();

    panGesture.externalContinueWith(panGesture);
    panGesture.externalSimultaneous(panGesture);
    panGesture.externalWaitFor(panGesture);

    expect(panGesture.continueWith).not.toContain(panGesture);
    expect(panGesture.simultaneousWith).not.toContain(panGesture);
    expect(panGesture.waitFor).not.toContain(panGesture);
  });
});
