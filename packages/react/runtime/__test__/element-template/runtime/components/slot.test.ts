// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { __etSlot } from '../../../../src/element-template/internal.js';

describe('__etSlot', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should throw in main thread', () => {
    vi.stubGlobal('__BACKGROUND__', false);
    const children = 'test children';
    expect(() => __etSlot(0, children)).toThrow(
      '__etSlot() should not run on the main thread. LEPUS ET children are lowered to slot arrays at compile time.',
    );
  });
});
