// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { profile } from '../src/utils/profile';

describe('profile', () => {
  const originalProfile = console.profile;
  const originalProfileEnd = console.profileEnd;

  afterEach(() => {
    console.profile = originalProfile;
    console.profileEnd = originalProfileEnd;
  });

  it('uses console.profile when available', () => {
    globalThis.__DEV__ = true;
    console.profile = vi.fn();
    console.profileEnd = vi.fn();

    const ret = profile('x', () => 123);
    expect(ret).toBe(123);
    expect(console.profile).toHaveBeenCalledWith('x');
    expect(console.profileEnd).toHaveBeenCalled();
  });
});
