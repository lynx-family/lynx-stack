// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, vi } from 'vitest';

import { soloScale } from '../../plugins/lynx/soloScale.js';
import { runPlugin } from '../utils/run-plugin.js';

describe('soloScale plugin', () => {
  it('covers all branches', () => {
    const { api } = runPlugin(soloScale, {
      theme: {
        scale: {
          '95': '0.95',
          '100': '1',
          '105': '1.05',
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
    expect(utils['solo-scale']?.(null)).toBeNull();
    expect(utils['solo-scale-x']?.(undefined)).toBeNull();
    expect(utils['solo-scale-y']?.(false)).toBeNull();
    expect(utils['solo-scale']?.(42)).toBeNull();

    // Valid inputs
    expect(utils['solo-scale']?.('1')).toEqual({
      transform: 'scale(1)',
    });

    expect(utils['solo-scale-x']?.('0.95')).toEqual({
      transform: 'scaleX(0.95)',
    });

    expect(utils['solo-scale-y']?.('1.05')).toEqual({
      transform: 'scaleY(1.05)',
    });
  });
});
