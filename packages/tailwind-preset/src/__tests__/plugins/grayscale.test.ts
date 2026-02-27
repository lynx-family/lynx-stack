// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, vi } from 'vitest';

import { grayscale } from '../../plugins/lynx/grayscale.js';
import { runPlugin } from '../utils/run-plugin.js';

describe('grayscale plugin', () => {
  it('covers all branches', () => {
    const { api } = runPlugin(grayscale, {
      theme: {
        grayscale: {
          none: '',
          0: '0',
          DEFAULT: '100%',
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

    // Invalid input
    expect(utils['grayscale']?.(null)).toBeNull();
    expect(utils['grayscale']?.(undefined)).toBeNull();
    expect(utils['grayscale']?.(false)).toBeNull();
    expect(utils['grayscale']?.(1)).toBeNull();

    // Special case: empty string / only whitespace
    expect(utils['grayscale']?.('')).toEqual({ filter: 'none' });
    expect(utils['grayscale']?.('   ')).toEqual({ filter: 'none' });

    // Valid theme values
    expect(utils['grayscale']?.('0')).toEqual({ filter: 'grayscale(0)' });
    expect(utils['grayscale']?.('100%')).toEqual({ filter: 'grayscale(100%)' });

    // Arbitrary value
    expect(utils['grayscale']?.('60%')).toEqual({ filter: 'grayscale(60%)' });
  });
});
