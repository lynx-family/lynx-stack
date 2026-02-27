// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from 'vitest';

describe('Main package exports', () => {
  test('should export all animation functions', async () => {
    const module = await import('../src/index.js');

    expect(module.animate).toBeDefined();
    expect(module.stagger).toBeDefined();
    expect(module.motionValue).toBeDefined();
    expect(module.spring).toBeDefined();
    expect(module.springValue).toBeDefined();
    expect(module.mix).toBeDefined();
    expect(module.progress).toBeDefined();
    expect(module.mapValue).toBeDefined();
    expect(module.clamp).toBeDefined();
    expect(module.transformValue).toBeDefined();
    expect(module.styleEffect).toBeDefined();
  });

  test('should export hooks', async () => {
    const module = await import('../src/index.js');

    expect(module.useMotionValueRefEvent).toBeDefined();
    expect(module.useMotionValueRef).toBeDefined();
  });
});
