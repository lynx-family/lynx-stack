// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { profile } from '../../src/worklet-runtime/utils/profile';

describe('profile', () => {
  const originalProfile = console.profile;
  const originalProfileEnd = console.profileEnd;

  afterEach(() => {
    vi.unstubAllGlobals();
    console.profile = originalProfile;
    console.profileEnd = originalProfileEnd;
  });

  it.each([true, false])('respects __PROFILE__=%s independently of __DEV__', (enabled) => {
    vi.stubGlobal('__PROFILE__', enabled);
    vi.stubGlobal('__DEV__', !enabled);
    console.profile = vi.fn();
    console.profileEnd = vi.fn();

    expect(profile('x', () => 123)).toBe(123);
    if (enabled) {
      expect(console.profile).toHaveBeenCalledWith('x');
      expect(console.profileEnd).toHaveBeenCalledTimes(1);
    } else {
      expect(console.profile).not.toHaveBeenCalled();
      expect(console.profileEnd).not.toHaveBeenCalled();
    }
  });
});
