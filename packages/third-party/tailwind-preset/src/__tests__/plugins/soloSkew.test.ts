// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, vi } from 'vitest';

import { soloSkew } from '../../plugins/lynx/soloSkew.js';
import { runPlugin } from '../utils/run-plugin.js';

describe('soloSkew plugin', () => {
  it('covers all branches', () => {
    const { api } = runPlugin(soloSkew, {
      theme: {
        skew: {
          '3': '3deg',
          '-6': '-6deg',
        },
      },
    });

    const matchUtilities = vi.mocked(api.matchUtilities);

    type UtilityFn = (value: unknown) => Record<string, string> | null;

    const utils = matchUtilities.mock.calls.reduce<Record<string, UtilityFn>>(
      (acc, call) => {
        const group = call[0] as Record<string, UtilityFn>;
        for (const key in group) {
          if (group[key]) {
            acc[key] = group[key]!;
          }
        }
        return acc;
      },
      {},
    );

    // Invalid inputs
    expect(utils['solo-skew']?.(null)).toBeNull();
    expect(utils['solo-skew-x']?.(undefined)).toBeNull();
    expect(utils['solo-skew-y']?.(false)).toBeNull();
    expect(utils['solo-skew']?.(123)).toBeNull();

    // Valid inputs
    expect(utils['solo-skew']?.('3deg')).toEqual({
      transform: 'skew(3deg)',
    });

    expect(utils['solo-skew-x']?.('-6deg')).toEqual({
      transform: 'skewX(-6deg)',
    });

    expect(utils['solo-skew-y']?.('45deg')).toEqual({
      transform: 'skewY(45deg)',
    });
  });
});
