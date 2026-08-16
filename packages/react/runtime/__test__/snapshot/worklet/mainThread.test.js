// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import { mainThread } from '../../../src/snapshot/worklet/mainThread';

describe('mainThread marker', () => {
  it('should be an identity function at runtime', () => {
    // The thread boundary is established by directive inference at compile
    // time; the marker itself must stay transparent, including in unbundled
    // development paths.
    const fn = (value) => value + 1;
    expect(mainThread(fn)).toBe(fn);
    expect(mainThread(fn)(41)).toBe(42);
  });
});
