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

const MainThreadFunction = {
  _wkltId: 'test:clone',
};

describe('Gesture Cloning', () => {
  describe('Clone Configuration', () => {
    test('should clone PanGesture with config', () => {
      const original = new PanGesture();
      original.minDistance(50);
      original.enabled(false);

      const cloned = original.clone();

      expect(cloned.config.minDistance).toBe(50);
      expect(cloned.config.enabled).toBe(false);
      expect(cloned.id).toBe(original.id);
      expect(cloned.execId).toBe(original.execId);
    });

    test('should clone TapGesture with config', () => {
      const original = new TapGesture();
      original.maxDuration(300);
      original.maxDistance(15);
      original.numberOfTaps(2);

      const cloned = original.clone();

      expect(cloned.config.maxDuration).toBe(300);
      expect(cloned.config.maxDistance).toBe(15);
      expect(cloned.config.numberOfTaps).toBe(2);
    });

    test('should clone LongPressGesture with config', () => {
      const original = new LongPressGesture();
      original.minDuration(800);
      original.maxDistance(5);

      const cloned = original.clone();

      expect(cloned.config.minDuration).toBe(800);
      expect(cloned.config.maxDistance).toBe(5);
    });

    test('should clone DefaultScrollGesture with config', () => {
      const original = new DefaultScrollGesture();
      original.tapSlop(7);

      const cloned = original.clone();

      expect(cloned.config.tapSlop).toBe(7);
    });
  });

  describe('Clone Callbacks', () => {
    test('should clone gesture with callbacks', () => {
      const original = new PanGesture();
      // @ts-expect-error Testing runtime behavior
      original.onUpdate(MainThreadFunction);
      // @ts-expect-error Testing runtime behavior
      original.onBegin(MainThreadFunction);

      const cloned = original.clone();

      expect(cloned.callbacks.onUpdate).toBeDefined();
      expect(cloned.callbacks.onBegin).toBeDefined();
    });

    test('should clone all callback types', () => {
      const original = new TapGesture();
      // @ts-expect-error Testing runtime behavior
      original.onBegin(MainThreadFunction);
      // @ts-expect-error Testing runtime behavior
      original.onStart(MainThreadFunction);
      // @ts-expect-error Testing runtime behavior
      original.onEnd(MainThreadFunction);
      // @ts-expect-error Testing runtime behavior
      original.onTouchesDown(MainThreadFunction);
      // @ts-expect-error Testing runtime behavior
      original.onTouchesMove(MainThreadFunction);
      // @ts-expect-error Testing runtime behavior
      original.onTouchesUp(MainThreadFunction);
      // @ts-expect-error Testing runtime behavior
      original.onTouchesCancel(MainThreadFunction);

      const cloned = original.clone();

      expect(cloned.callbacks.onBegin).toBeDefined();
      expect(cloned.callbacks.onStart).toBeDefined();
      expect(cloned.callbacks.onEnd).toBeDefined();
      expect(cloned.callbacks.onTouchesDown).toBeDefined();
      expect(cloned.callbacks.onTouchesMove).toBeDefined();
      expect(cloned.callbacks.onTouchesUp).toBeDefined();
      expect(cloned.callbacks.onTouchesCancel).toBeDefined();
    });
  });

  describe('Clone Relationships', () => {
    test('should clone simultaneousWith relationships', () => {
      const gesture1 = new PanGesture();
      const gesture2 = new TapGesture();

      gesture1.externalSimultaneous(gesture2);
      const cloned = gesture1.clone();

      expect(cloned.simultaneousWith.length).toBe(
        gesture1.simultaneousWith.length,
      );
      expect(cloned.simultaneousWith).toContain(gesture2);
    });

    test('should clone waitFor relationships', () => {
      const gesture1 = new PanGesture();
      const gesture2 = new TapGesture();

      gesture1.externalWaitFor(gesture2);
      const cloned = gesture1.clone();

      expect(cloned.waitFor.length).toBe(gesture1.waitFor.length);
      expect(cloned.waitFor).toContain(gesture2);
    });

    test('should clone continueWith relationships', () => {
      const gesture1 = new PanGesture();
      const gesture2 = new TapGesture();

      gesture1.externalContinueWith(gesture2);
      const cloned = gesture1.clone();

      expect(cloned.continueWith.length).toBe(gesture1.continueWith.length);
      expect(cloned.continueWith).toContain(gesture2);
    });

    test('should clone all relationships together', () => {
      const gesture1 = new PanGesture();
      const gesture2 = new TapGesture();
      const gesture3 = new LongPressGesture();
      const gesture4 = new FlingGesture();

      gesture1.externalSimultaneous(gesture2);
      gesture1.externalWaitFor(gesture3);
      gesture1.externalContinueWith(gesture4);

      const cloned = gesture1.clone();

      expect(cloned.simultaneousWith).toContain(gesture2);
      expect(cloned.waitFor).toContain(gesture3);
      expect(cloned.continueWith).toContain(gesture4);
    });
  });

  describe('Clone Identity', () => {
    test('cloned gesture should have same ID', () => {
      const original = new PanGesture();
      const cloned = original.clone();

      expect(cloned.id).toBe(original.id);
    });

    test('cloned gesture should have same execId', () => {
      const original = new PanGesture();
      original.minDistance(50);
      original.enabled(false);

      const cloned = original.clone();

      expect(cloned.execId).toBe(original.execId);
    });

    test('cloned gesture should have same type', () => {
      const original = new PanGesture();
      const cloned = original.clone();

      expect(cloned.type).toBe(original.type);
    });

    test('cloned gesture should be instance of same class', () => {
      const gestures = [
        new PanGesture(),
        new TapGesture(),
        new LongPressGesture(),
        new FlingGesture(),
        new DefaultScrollGesture(),
      ];

      gestures.forEach((original) => {
        const cloned = original.clone();
        expect(cloned.constructor).toBe(original.constructor);
      });
    });
  });

  describe('Clone Behavior', () => {
    test('cloned gesture shares config object (shallow copy)', () => {
      const original = new PanGesture();
      original.minDistance(50);

      const cloned = original.clone();

      // Config is shallow copied, so they share the same object
      expect(cloned.config).toBe(original.config);

      // Modifying through methods affects both since they share config
      cloned.minDistance(100);
      expect(original.config.minDistance).toBe(100);
      expect(cloned.config.minDistance).toBe(100);
    });

    test('cloned gesture has same execId initially', () => {
      const original = new PanGesture();
      original.minDistance(50);
      const originalExecId = original.execId;

      const cloned = original.clone();

      // Clone has same execId as original at time of cloning
      expect(cloned.execId).toBe(originalExecId);
    });
  });

  describe('Clone Special Properties', () => {
    test('should clone PanGesture distanceSet property', () => {
      const original = new PanGesture();
      original.minDistance(50);
      expect(original.distanceSet).toBe(true);

      const cloned = original.clone();
      expect(cloned.distanceSet).toBe(true);
    });

    test('should clone __isGesture marker', () => {
      const original = new PanGesture();
      const cloned = original.clone();

      expect(cloned.__isGesture).toBe(true);
    });
  });
});
