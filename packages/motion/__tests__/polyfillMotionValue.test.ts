// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

describe('Polyfill MotionValue', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should export motionValue from motion-dom', async () => {
    const module = await import('../src/polyfill/MotionValue.js');
    expect(module.motionValue).toBeDefined();
  });

  test('motionValue should return an object with toJSON', async () => {
    const { motionValue } = await import('../src/polyfill/MotionValue.js');
    const mv = motionValue(100);

    expect(mv).toBeDefined();
    expect(mv.get()).toBe(100);

    // The patched toJSON should return empty object
    const json = (mv as any).toJSON();
    expect(json).toEqual({});
  });

  test('motionValue toJSON returns empty object to prevent cross-thread sync', async () => {
    const { motionValue } = await import('../src/polyfill/MotionValue.js');
    const mv = motionValue('test-string');

    const json = (mv as any).toJSON();
    expect(json).toEqual({});
    // Value should still be accessible normally
    expect(mv.get()).toBe('test-string');
  });
});
